// CareTrail application state and actions.
//
// FHIR is the source of truth. For each household the server loads its FHIR
// resources, rebuilds the engine record (consent enforced at that step), runs
// the guideline engine, the trend engine and wearable change detection, and
// caches the result. Every write goes back to FHIR, is appended to the
// data-use ledger, refreshes that household and is pushed to open screens.

import { readFileSync } from "node:fs";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { evaluateHousehold } from "../src/engine.js";
import { FhirStore } from "./fhir/store.mjs";
import { fromFhir, referralToFhir, getExt } from "./fhir/mapping.mjs";
import { CS, cc, findCode, EXT } from "./fhir/codes.mjs";
import { buildSeed, CLINICS, SERVICES } from "./seed.mjs";
import { Ledger } from "./ledger.mjs";
import { suggestionsFor, trendSignals } from "./ai/trends.mjs";
import { wearableChange } from "./ai/wearables.mjs";
import * as lapse from "./ai/lapse.mjs";
import * as bandit from "./ai/bandit.mjs";
import { rng } from "./util.mjs";

const RULES = JSON.parse(readFileSync(new URL("../data/rules.json", import.meta.url)));
const MIN_CELL = 10;
const SCREENED = new Set(["up_to_date", "due_soon", "open_loop"]);
const NOT_ELIGIBLE = new Set(["not_eligible", "uncertain", "info"]);

export const PERSONAS = [
  { id: "family-DEMO-1", role: "family", hh: "DEMO-1", sub: "DEMO-1-01", name: "Mariam", label: "Al Mansouri family (Thiqa, Abu Dhabi City)" },
  { id: "family-DEMO-2", role: "family", hh: "DEMO-2", sub: "DEMO-2-01", name: "Ayesha", label: "Khan family (Basic, Al Ain)" },
  { id: "family-DEMO-3", role: "family", hh: "DEMO-3", sub: "DEMO-3-01", name: "Noura", label: "Al Dhaheri family (Thiqa, Al Dhafra)" },
  { id: "clinician", role: "clinician", sub: "clinician-1", name: "Dr. Sara Haddad (synthetic)", label: "Family physician, primary care" },
  { id: "program", role: "program", sub: "program-1", name: "Screening team (demo)", label: "ADPHC population screening" },
];

export class CareTrail {
  constructor({ dbPath = process.env.DB_PATH || "/tmp/caretrail.db" } = {}) {
    this.dbPath = dbPath;
    this.listeners = new Set();
    this.boot();
  }

  // ---------------------------------------------------------------- boot

  boot() {
    const t0 = Date.now();
    this.store = new FhirStore(this.dbPath);
    this.store.db.exec("CREATE TABLE IF NOT EXISTS ops (person TEXT PRIMARY KEY, household TEXT, json TEXT NOT NULL)");
    if (this.store.isEmpty()) { this.#seed(); this.store.db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); }
    this.ref = this.store.kv("reference_date");
    this.secret = this.store.kv("token_secret") || this.store.kv("token_secret", randomBytes(32).toString("hex"));
    this.ledger = new Ledger(this.store);
    if (this.ledger.entries.length === 0) this.#seedLedger();
    this.households = this.store.kv("households");
    this.ops = new Map(this.store.db.prepare("SELECT person, json FROM ops").all().map((r) => [r.person, JSON.parse(r.json)]));
    this.decisions = this.store.kv("suggestion_decisions") || {};
    this.snoozes = this.store.kv("snoozes") || {};
    this.banditState = this.store.kv("bandit") || bandit.newState();
    this.cache = new Map();
    for (const h of this.households) this.refresh(h.id, { quiet: true });
    this.retrain({ quiet: true });
    this.bootMs = Date.now() - t0;
  }

  #seed() {
    const s = buildSeed();
    this.store.putMany(s.resources, { now: `${s.ref}T06:00:00.000Z` });
    this.store.kv("reference_date", s.ref);
    this.store.kv("households", s.households);
    const ins = this.store.db.prepare("INSERT INTO ops (person, household, json) VALUES (?, ?, ?)");
    this.store.db.exec("BEGIN");
    for (const o of s.ops) ins.run(o.person, o.household, JSON.stringify(o));
    this.store.db.exec("COMMIT");
  }

  #seedLedger() {
    const seed = [
      { ts: "2026-05-20T10:12:00Z", hh: "DEMO-2", subject: "DEMO-2-03", actor: "actor_clinic", action: "referral_created", purpose: "purpose_referral", data: ["screening_history"], key: "mchat_r_18" },
      { ts: "2026-08-03T17:40:00Z", hh: "DEMO-3", subject: "DEMO-3-01", actor: "person:DEMO-3-01", action: "declined", purpose: "purpose_consent", data: ["screening_history"], key: "female_repro" },
      { ts: "2026-10-21T08:05:00Z", hh: "DEMO-1", subject: "DEMO-1-02", actor: "actor_lab", action: "result_received", purpose: "purpose_result", data: ["screening_history"], key: "major" },
      { ts: "2026-11-02T09:31:00Z", hh: "DEMO-1", subject: "DEMO-1-02", actor: "actor_adphc", action: "program_view", purpose: "purpose_program", data: ["demographics", "screening_history"], key: "major" },
      { ts: "2026-11-09T11:02:00Z", hh: "DEMO-2", subject: "DEMO-2-03", actor: "actor_adphc", action: "program_view", purpose: "purpose_program", data: ["demographics", "screening_history"], key: "mchat_r_18" },
    ];
    for (const e of seed) this.ledger.append(e);
  }

  close() { this.store.db.close(); }

  // ---------------------------------------------------------------- auth

  token(persona) {
    const p = PERSONAS.find((x) => x.id === persona);
    if (!p) return null;
    const body = Buffer.from(JSON.stringify({ id: p.id, role: p.role, hh: p.hh, sub: p.sub, iat: Date.now() })).toString("base64url");
    const sig = createHmac("sha256", this.secret).update(body).digest("base64url");
    return { token: `${body}.${sig}`, user: p };
  }
  verifyToken(tok) {
    if (!tok || !tok.includes(".")) return null;
    const [body, sig] = tok.split(".");
    const want = createHmac("sha256", this.secret).update(body).digest();
    const got = Buffer.from(sig, "base64url");
    if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
    const claims = JSON.parse(Buffer.from(body, "base64url").toString());
    return { ...PERSONAS.find((p) => p.id === claims.id), ...claims };
  }

  // ---------------------------------------------------------------- events

  emit(event) { for (const fn of this.listeners) fn(event); }
  log(entry) {
    const e = this.ledger.append({ ts: new Date().toISOString(), data: [], ...entry });
    this.store.put({
      resourceType: "AuditEvent",
      id: `audit-${e.i}`,
      type: { system: "http://terminology.hl7.org/CodeSystem/audit-event-type", code: "rest" },
      recorded: e.ts,
      outcome: "0",
      agent: [{ who: { display: e.actor }, requestor: true }],
      source: { observer: { display: "CareTrail" } },
      entity: e.subject ? [{ what: { reference: e.subject.startsWith("P-") ? undefined : `Patient/${e.subject}`, display: e.subject } }] : undefined,
      purposeOfEvent: [{ text: e.purpose }],
      extension: [{ url: EXT + "ledger-index", valueInteger: e.i }],
    });
    this.emit({ type: "ledger", hh: e.hh, i: e.i });
    return e;
  }

  // ---------------------------------------------------------------- per-household state

  refresh(hhId, { quiet = false } = {}) {
    const group = this.store.get("Group", hhId);
    const resources = this.store.household(hhId);
    const record = fromFhir(group, resources);
    const evalRes = evaluateHousehold(record, RULES, this.ref);
    const suggestions = record.members.flatMap((p) => suggestionsFor(p, this.ref)).map((s) => ({ ...s, ...(this.decisions[s.id] || { status: "pending" }) }));
    const signals = Object.fromEntries(record.members.map((p) => [p.id, trendSignals(p, this.ref)]).filter(([, v]) => v.length));
    const changes = Object.fromEntries(record.members.map((p) => [p.id, p.wearable_series ? wearableChange(p.wearable_series) : null]).filter(([, v]) => v));
    const appointments = resources.filter((r) => r.resourceType === "Appointment" && r.status === "booked");
    const plans = resources.filter((r) => r.resourceType === "ServiceRequest" && r.intent === "plan" && r.status === "active");
    const entry = { record, eval: evalRes, suggestions, signals, changes, appointments, plans };
    this.cache.set(hhId, entry);
    this.aggregates = null;
    if (!quiet) this.emit({ type: "household", hh: hhId });
    return entry;
  }
  hh(id) { return this.cache.get(id) || this.refresh(id); }
  personRecord(pid) {
    const hhId = this.store.householdOf(pid);
    const h = this.hh(hhId);
    return { hh: h, person: h.record.members.find((m) => m.id === pid), hhId };
  }

  // ---------------------------------------------------------------- family

  familyView(user) {
    const h = this.hh(user.hh);
    const managerId = user.sub;
    const memberOut = h.eval.members.map((m) => {
      const p = m.person;
      const isPrivate = p.kind === "adult" && p.id !== managerId && p.consent?.share_with_household === false;
      const plans = h.plans.filter((sr) => sr.subject.reference === `Patient/${p.id}`).map((sr) => ({
        id: `plan:${sr.id}`, personId: p.id, personName: p.display_name || p.role, program: "PLAN", key: getExt(sr, "suggestion-kind"),
        title: sr.code.text, status: "doctor_recommended", tier: 2, decision: "clinical",
        reasons: [{ code: "doctor_recommended", by: sr.requester?.display, date: sr.authoredOn, due: sr.occurrenceDateTime }],
        factors: [], dataUsed: ["clinical"], source: "Clinician decision on a CareTrail trend suggestion", service: "recheck",
      }));
      const items = [...plans, ...m.items].map((i) => this.#decorate(i, h, p));
      return {
        id: p.id, name: p.display_name || p.role, role: p.role, kind: p.kind, sex: p.sex, birth_date: p.birth_date,
        consent: p.consent, private: isPrivate, items: isPrivate ? [] : items,
        wearable: !isPrivate && p.consent?.wearables ? p.wearable : null,
        change: !isPrivate && p.consent?.wearables ? h.changes[p.id] || null : null,
        wcv: p.kind === "child" ? p.wcv : undefined,
      };
    });
    const actions = memberOut.flatMap((m) => m.items).filter((i) => i.tier && i.tier <= 4 && !i.snoozedUntil).sort((a, b) => a.tier - b.tier || clin(b) - clin(a) || (b.priority || 0) - (a.priority || 0));
    const rec = h.record;
    return {
      ref: this.ref,
      household: { id: rec.id, label: rec.label, insurance: rec.insurance, region: rec.region, preferred_language: rec.preferred_language, preferred_channel: rec.preferred_channel },
      manager: managerId,
      members: memberOut,
      actions,
      appointments: h.appointments.map((a) => this.#appt(a)),
    };
  }

  #decorate(i, h, p) {
    if (i.key === "major" && h.signals[p.id]) i = { ...i, factors: [...(i.factors || []), ...h.signals[p.id]], dataUsed: [...new Set([...(i.dataUsed || []), "clinical"])] };
    const appt = h.appointments.find((a) => getExt(a, "item-id") === i.id);
    const snooze = this.snoozes[i.id];
    const service = i.service || (i.status === "open_loop" || i.status === "referral_pending" ? "specialist" : i.program === "WCV" ? "child" : "screening");
    const { person, ...rest } = i;
    return { ...rest, service, booked: appt ? this.#appt(appt) : null, snoozedUntil: snooze && snooze > this.ref ? snooze : null };
  }
  #appt(a) {
    return { id: a.id, start: a.start, end: a.end, location: a.participant?.find((x) => x.actor?.reference?.startsWith("Location/"))?.actor?.display, service: findCode(a.serviceType?.[0], CS.slotService), itemId: getExt(a, "item-id"), patient: a.participant?.find((x) => x.actor?.reference?.startsWith("Patient/"))?.actor?.reference.split("/")[1] };
  }

  #assertMember(user, pid) {
    if (this.store.householdOf(pid) !== user.hh) throw Object.assign(new Error("Not a member of your household"), { status: 403 });
  }

  setConsent(user, pid, category, value) {
    this.#assertMember(user, pid);
    if (!["genomic", "wearables", "share_with_household"].includes(category)) throw Object.assign(new Error("Unknown consent category"), { status: 400 });
    const id = `consent-${pid}-${category.replace(/_/g, "-")}`;
    const c = this.store.get("Consent", id) || { resourceType: "Consent", id, status: "active", scope: cc("http://terminology.hl7.org/CodeSystem/consentscope", "patient-privacy"), category: [cc(CS.consent, category)], patient: { reference: `Patient/${pid}` }, policyRule: { text: "CareTrail data-use consent" } };
    this.store.put({ ...c, dateTime: new Date().toISOString(), provision: { type: value ? "permit" : "deny" } });
    this.log({ hh: user.hh, subject: pid, actor: `person:${pid}`, action: "consent", purpose: "purpose_consent", consent: category, value: !!value });
    return this.refresh(user.hh);
  }

  decline(user, pid, key) {
    this.#assertMember(user, pid);
    this.store.put({ resourceType: "Procedure", id: `decl-${pid}-${key.replace(/_/g, "-")}`, status: "not-done", statusReason: { text: "Declined by the person" }, code: cc(CS.package, key), subject: { reference: `Patient/${pid}` }, performedDateTime: this.ref });
    this.log({ hh: user.hh, subject: pid, actor: `person:${pid}`, action: "declined", purpose: "purpose_consent", data: ["screening_history"], key });
    return this.refresh(user.hh);
  }

  snooze(user, itemId, patient, days = 30) {
    this.#assertMember(user, patient);
    const until = new Date(new Date(this.ref).getTime() + days * 864e5).toISOString().slice(0, 10);
    this.snoozes[itemId] = until;
    this.store.kv("snoozes", this.snoozes);
    this.log({ hh: user.hh, subject: patient, actor: `person:${user.sub}`, action: "snoozed", purpose: "purpose_consent", key: itemId.split(":").pop() });
    return this.refresh(user.hh);
  }

  slots(user, service, days = 14) {
    const region = this.hh(user.hh).record.region;
    const clinics = CLINICS.filter((c) => c.region === region);
    const from = `${this.ref}`, to = new Date(new Date(this.ref).getTime() + days * 864e5).toISOString().slice(0, 10);
    const out = [];
    for (const c of clinics) {
      const { entries } = this.store.search("Slot", { schedule: `Schedule/sched-${c.id}-${service}`, status: "free", start: [`ge${from}`, `le${to}`], _count: 200 });
      out.push(...entries.map((s) => ({ id: s.id, start: s.start, end: s.end, clinic: c.name, clinicId: c.id })));
    }
    return out.sort((a, b) => a.start.localeCompare(b.start)).slice(0, 40);
  }

  book(user, { slotId, patient, itemId, title }) {
    this.#assertMember(user, patient);
    const slot = this.store.get("Slot", slotId);
    if (!slot || slot.status !== "free") throw Object.assign(new Error("This time is no longer free. Please pick another."), { status: 409 });
    const sched = this.store.get("Schedule", slot.schedule.reference.split("/")[1]);
    const loc = sched.actor[0];
    this.store.put({ ...slot, status: "busy" });
    const appt = this.store.put({
      resourceType: "Appointment",
      id: `appt-${slotId.replace(/^slot-/, "")}`,
      status: "booked",
      serviceType: slot.serviceType,
      description: title,
      start: slot.start,
      end: slot.end,
      slot: [{ reference: `Slot/${slot.id}` }],
      created: new Date().toISOString(),
      participant: [
        { actor: { reference: `Patient/${patient}` }, status: "accepted" },
        { actor: { reference: loc.reference, display: loc.display }, status: "accepted" },
      ],
      extension: [{ url: EXT + "item-id", valueString: itemId }],
    });
    this.log({ hh: user.hh, subject: patient, actor: `person:${user.sub}`, action: "booking", purpose: "purpose_booking", data: ["demographics"], key: itemId.split(":")[1], detail: slot.start });
    this.refresh(user.hh);
    this.emit({ type: "booking", hh: user.hh, start: slot.start });
    return this.#appt(appt);
  }

  cancel(user, apptId) {
    const a = this.store.get("Appointment", apptId);
    if (!a) throw Object.assign(new Error("Appointment not found"), { status: 404 });
    const pid = a.participant.find((x) => x.actor.reference.startsWith("Patient/")).actor.reference.split("/")[1];
    this.#assertMember(user, pid);
    this.store.put({ ...a, status: "cancelled", cancelationReason: { text: "Cancelled by the person" } });
    const slot = this.store.get("Slot", a.slot[0].reference.split("/")[1]);
    if (slot) this.store.put({ ...slot, status: "free" });
    this.log({ hh: user.hh, subject: pid, actor: `person:${user.sub}`, action: "booking_cancelled", purpose: "purpose_booking", key: getExt(a, "item-id")?.split(":")[1] });
    return this.refresh(user.hh);
  }

  // ---------------------------------------------------------------- clinician

  clinicianQueue() {
    const loops = [], pending = [], decided = [];
    const demoFirst = (a, b) => (b.demo - a.demo) || (a.date || "").localeCompare(b.date || "");
    for (const { id, demo } of this.households) {
      const h = this.hh(id);
      for (const m of h.eval.members) {
        for (const i of m.items) {
          if (i.status !== "open_loop" && i.status !== "referral_pending") continue;
          const r = i.reasons[0];
          loops.push({ demo, hh: id, patient: m.person.id, name: m.person.display_name || null, age: ageOf(m.person.birth_date, this.ref), sex: m.person.sex, key: i.resultKey || i.key, itemKey: i.key, program: i.program, title: i.title, stage: r.code, date: r.date, specialist: r.specialist, limit: r.limit, source: i.source });
        }
      }
      for (const s of h.suggestions) {
        const p = h.record.members.find((x) => x.id === s.personId);
        const row = { demo, hh: id, ...s, name: p.display_name || null, age: ageOf(p.birth_date, this.ref), sex: p.sex, conditions: p.conditions, family_history: p.family_history, genomic: p.genomic_findings };
        (s.status === "pending" ? pending : decided).push(row);
      }
    }
    loops.sort(demoFirst);
    pending.sort((a, b) => (b.demo - a.demo) || (a.proposed_date || "").localeCompare(b.proposed_date || ""));
    return { openLoops: { total: loops.length, rows: loops.slice(0, 40) }, suggestions: { total: pending.length, rows: pending.slice(0, 40) }, decided: decided.slice(-20).reverse() };
  }

  referral(user, { patient, key, decision, specialist, note }) {
    const { person, hhId } = this.personRecord(patient);
    const isWcv = !!person.wcv?.results?.[key];
    const reason = isWcv ? `Observation/wcvr-${patient}-${key.replace(/_/g, "-")}` : `Procedure/scr-${patient}-${key.replace(/_/g, "-")}`;
    const existing = this.store.get("ServiceRequest", `ref-${patient}-${key.replace(/_/g, "-")}`);
    if (decision === "complete") {
      if (!existing) throw Object.assign(new Error("No referral to complete"), { status: 400 });
      this.store.put({ ...existing, status: "completed", extension: [...(existing.extension || []).filter((e) => !e.url.endsWith("completed-on")), { url: EXT + "completed-on", valueString: this.ref }] });
    } else {
      const sr = referralToFhir(patient, key, { made: true, made_on: this.ref, completed: decision === "manage", completed_on: decision === "manage" ? this.ref : null, specialist: decision === "manage" ? "Managed in primary care" : specialist, requester: user.name }, reason);
      if (note) sr.note = [{ text: note, authorString: user.name, time: new Date().toISOString() }];
      this.store.put(sr);
    }
    this.log({ hh: hhId, subject: patient, actor: "actor_clinician", actorName: user.name, action: decision === "complete" ? "referral_completed" : decision === "manage" ? "loop_managed" : "referral_created", purpose: "purpose_referral", data: ["screening_history", "clinical"], key });
    return this.refresh(hhId);
  }

  decideSuggestion(user, { id, decision, note }) {
    const pid = id.replace(/^sug-/, "").replace(/-(hba1c_recheck|bp_review|lipid_review)$/, "");
    const { hh, hhId } = this.personRecord(pid);
    const s = hh.suggestions.find((x) => x.id === id);
    if (!s) throw Object.assign(new Error("Suggestion not found"), { status: 404 });
    this.decisions[id] = { status: decision === "approve" ? "approved" : "rejected", decidedBy: user.name, decidedOn: this.ref, note: note || null };
    this.store.kv("suggestion_decisions", this.decisions);
    if (decision === "approve") {
      const titles = { hba1c_recheck: "HbA1c recheck", bp_review: "Blood pressure review", lipid_review: "Cholesterol (LDL) review" };
      this.store.put({
        resourceType: "ServiceRequest",
        id: `plan-${id}`,
        status: "active",
        intent: "plan",
        code: { text: titles[s.kind] },
        subject: { reference: `Patient/${pid}` },
        authoredOn: this.ref,
        occurrenceDateTime: s.proposed_date,
        requester: { display: user.name },
        note: note ? [{ text: note }] : undefined,
        extension: [{ url: EXT + "suggestion-kind", valueString: s.kind }, { url: EXT + "suggestion-id", valueString: id }],
      });
    }
    this.log({ hh: hhId, subject: pid, actor: "actor_clinician", actorName: user.name, action: decision === "approve" ? "suggestion_approved" : "suggestion_rejected", purpose: "purpose_review", data: ["clinical", ...(s.reason === "genomic_fh_rising" ? ["genomic"] : [])], key: s.kind });
    return this.refresh(hhId);
  }

  clinicianPatient(pid) {
    const { person, hh } = this.personRecord(pid);
    return { person: { id: person.id, name: person.display_name, sex: person.sex, birth_date: person.birth_date, conditions: person.conditions, family_history: person.family_history, genomic: person.genomic_findings, labs: person.labs || {} }, suggestions: hh.suggestions.filter((s) => s.personId === pid) };
  }

  // ---------------------------------------------------------------- program

  pseudonym(pid) { return "P-" + createHmac("sha256", this.secret).update(pid).digest("hex").slice(0, 6).toUpperCase(); }

  retrain({ quiet = false } = {}) {
    const rows = [];
    for (const { id } of this.households) {
      const h = this.hh(id);
      for (const p of h.record.members) {
        const o = this.ops.get(p.id);
        if (!o) continue;
        const x = lapse.features(p, h.record, o, { ref: this.ref, trend: !!h.signals[p.id], wearable: !!h.changes[p.id] });
        rows.push({ x, y: o.outcome ? 0 : 1, pid: p.id, hh: id });
      }
    }
    const r = rng(11);
    const test = rows.filter(() => r() < 0.3);
    const testSet = new Set(test);
    const trainRows = rows.filter((x) => !testSet.has(x));
    const holdout = lapse.train(trainRows);
    const metrics = lapse.evaluate(holdout, test);
    const model = lapse.train(rows);
    const version = (this.model?.version || 0) + 1;
    this.model = { ...model, version, trained_at: new Date().toISOString(), n_train: rows.length, metrics, rows };
    this.aggregates = null;
    if (!quiet) this.emit({ type: "model", version });
    return { version, n_train: rows.length, ...metrics };
  }

  #ranked() {
    if (this.aggregates?.ranked) return this.aggregates.ranked;
    const rowsByPid = new Map(this.model.rows.map((r) => [r.pid, r]));
    const out = [];
    for (const { id, demo } of this.households) {
      const h = this.hh(id);
      for (const m of h.eval.members) {
        const gaps = m.items.filter((i) => i.tier && i.tier <= 4);
        const soon = m.items.filter((i) => i.tier === 5);
        const row = rowsByPid.get(m.person.id);
        if (!row) continue;
        const risk = lapse.predict(this.model, row.x);
        if (!gaps.length && !(soon.length && risk >= 0.55)) continue;
        const tier = gaps.length ? Math.min(...gaps.map((i) => i.tier)) : 5;
        const ctx = bandit.contextOf(m.person, h.record, this.ref);
        const [arm] = bandit.bestArm(this.banditState, ctx);
        out.push({
          pid: m.person.id, hh: id, demo, pseudonym: this.pseudonym(m.person.id), tier, proactive: !gaps.length,
          gaps: (gaps.length ? gaps : soon).map((i) => i.key), risk: +risk.toFixed(3),
          drivers: lapse.drivers(this.model, row.x).map((d) => ({ name: d.name, label: d.label })),
          context: ctx, recommended: arm, language: h.record.preferred_language,
          interpreter: !["ar", "en"].includes(h.record.preferred_language),
          booked: h.appointments.some((a) => a.participant.some((x) => x.actor.reference === `Patient/${m.person.id}`)),
          sex: m.person.sex, kind: m.person.kind, age: ageOf(m.person.birth_date, this.ref), national: h.record.national, region: h.record.region, y: row.y,
        });
      }
    }
    out.sort((a, b) => a.tier - b.tier || b.risk - a.risk);
    this.aggregates = { ...(this.aggregates || {}), ranked: out };
    return out;
  }

  queue({ offset = 0, limit = 15 } = {}) {
    const ranked = this.#ranked();
    return { total: ranked.length, proactive: ranked.filter((r) => r.proactive).length, rows: ranked.slice(offset, offset + limit).map(({ pid, hh, y, sex, age, national, region, kind, ...r }) => r) };
  }

  openRecord(user, pseudonym, purpose) {
    const row = this.#ranked().find((r) => r.pseudonym === pseudonym);
    if (!row) throw Object.assign(new Error("Unknown pseudonym"), { status: 404 });
    if (!["purpose_outreach", "purpose_followup", "purpose_quality"].includes(purpose)) throw Object.assign(new Error("A purpose is required"), { status: 400 });
    const e = this.log({ hh: row.hh, subject: row.pid, actor: "actor_adphc", actorName: user.name, action: "program_open", purpose, data: ["demographics", "screening_history"], pseudonym });
    const h = this.hh(row.hh);
    const p = h.record.members.find((m) => m.id === row.pid);
    return { ledgerIndex: e.i, contact: { household: h.record.label || `Household ${row.hh}`, member: p.display_name || p.role, preferred_channel: h.record.preferred_channel, preferred_language: h.record.preferred_language }, gaps: row.gaps };
  }

  overview() {
    if (this.aggregates?.overview) return this.aggregates.overview;
    const pkg = {};
    const ref = new Date(this.ref);
    let peopleWithGap = 0, peopleOpen = 0, people = 0, abnormal = 0, onTime = 0, proactive = 0;
    for (const { id } of this.households) {
      const h = this.hh(id);
      for (const m of h.eval.members) {
        people++;
        if (m.items.some((i) => i.tier && i.tier <= 4)) peopleWithGap++;
        if (m.items.some((i) => i.status === "open_loop")) peopleOpen++;
        for (const i of m.items) {
          if (i.program !== "IFHAS" || NOT_ELIGIBLE.has(i.status)) continue;
          const k = (pkg[i.key] = pkg[i.key] || { package: i.key, eligible: 0, screened: 0 });
          k.eligible++;
          if (SCREENED.has(i.status)) k.screened++;
        }
        for (const rec of Object.values(m.person.screening || {})) {
          if (rec.result !== "abnormal" || !rec.last_done) continue;
          if ((ref - new Date(rec.last_done)) / 864e5 < 21) continue;
          abnormal++;
          if (rec.referral?.made && (new Date(rec.referral.made_on) - new Date(rec.last_done)) / 864e5 <= 21) onTime++;
        }
      }
    }
    const pct = (a, b) => (b >= MIN_CELL ? +((100 * a) / b).toFixed(1) : null);
    const packages = Object.values(pkg).map((k) => ({ ...k, participation_pct: pct(k.screened, k.eligible), suppressed: k.eligible < MIN_CELL, target_pct: 85 })).sort((a, b) => b.eligible - a.eligible);
    const ranked = this.#ranked();
    proactive = ranked.filter((r) => r.proactive).length;
    const model = { version: this.model.version, trained_at: this.model.trained_at, n_train: this.model.n_train, ...this.model.metrics, coefficients: this.model.names.map((n, j) => ({ name: n, label: lapse.FEATURE_LABELS[n], coef: +this.model.w[j].toFixed(3) })).sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef)) };
    const overview = {
      ref: this.ref, people, households: this.households.length,
      care_gaps: peopleWithGap, open_loops: peopleOpen, proactive,
      referral_on_time_pct: pct(onTime, abnormal), abnormal_results: abnormal,
      major: packages.find((p) => p.package === "major"),
      packages, model, safeguards: this.#safeguards(ranked), min_cell: MIN_CELL,
      fhir: this.store.counts(),
    };
    this.aggregates = { ...(this.aggregates || {}), overview };
    return overview;
  }

  #safeguards(ranked) {
    const top = new Set(ranked.slice(0, Math.ceil(ranked.length * 0.3)).map((r) => r.pid));
    const groups = {
      "Sex (adults)": (r) => (r.kind === "adult" ? r.sex : null),
      "Age band": (r) => (r.kind === "child" ? "child" : r.age < 30 ? "18-29" : r.age < 45 ? "30-44" : r.age < 60 ? "45-59" : "60-75"),
      Nationality: (r) => (r.national ? "UAE national" : "Expatriate"),
      "Preferred language": (r) => (r.language === "ar" ? "Arabic" : r.language === "en" ? "English" : "Other"),
      Region: (r) => r.region,
    };
    const out = [];
    for (const [seg, fn] of Object.entries(groups)) {
      const by = new Map();
      for (const r of ranked) { const g = fn(r); if (g == null) continue; if (!by.has(g)) by.set(g, []); by.get(g).push(r); }
      for (const [g, list] of by) {
        if (list.length < MIN_CELL) { out.push({ segment: seg, group: g, suppressed: true }); continue; }
        const pred = list.reduce((s, r) => s + r.risk, 0) / list.length;
        const obs = list.reduce((s, r) => s + r.y, 0) / list.length;
        const gap = +(100 * (pred - obs)).toFixed(1);
        out.push({ segment: seg, group: g, n: list.length, prioritised_pct: +((100 * list.filter((r) => top.has(r.pid)).length) / list.length).toFixed(1), lapse_observed_pct: +(100 * obs).toFixed(1), lapse_predicted_pct: +(100 * pred).toFixed(1), calibration_gap_pts: gap, needs_local_recalibration: Math.abs(gap) > 5, suppressed: false });
      }
    }
    return out;
  }

  banditView() {
    const s = this.banditState;
    const table = bandit.CONTEXTS.map((ctx) => {
      const arms = bandit.ARMS.map((a) => { const [al, be] = s.posterior[ctx][a]; return { arm: a, mean: +(al / (al + be)).toFixed(3), n: al + be - 2 }; });
      const best = arms.slice().sort((a, b) => b.mean - a.mean)[0];
      return { context: ctx, best: best.arm, n: arms.reduce((x, a) => x + a.n, 0), arms };
    });
    return { week: s.week, history: s.history, table, baseline: bandit.BASELINE_ARM };
  }

  runOutreachWeek(user, n = 240) {
    const ranked = this.#ranked().filter((r) => !r.booked).slice(0, n);
    const people = ranked.map((r) => ({ pid: r.pid, ctx: r.context, pComplete: this.ops.get(r.pid)?.p_complete ?? 0.55 }));
    const summary = bandit.runWeek(this.banditState, people, 1000 + this.banditState.week);
    const upd = this.store.db.prepare("UPDATE ops SET json = ? WHERE person = ?");
    this.store.db.exec("BEGIN");
    for (const p of people) {
      const o = this.ops.get(p.pid);
      if (!o) continue;
      o.engagement.invites_3y++;
      if (p.result.ok) { o.engagement.responded_3y++; o.outcome = true; }
      upd.run(JSON.stringify(o), p.pid);
    }
    this.store.db.exec("COMMIT");
    this.store.kv("bandit", this.banditState);
    this.log({ hh: "POP", subject: null, actor: "actor_adphc", actorName: user.name, action: "outreach_week", purpose: "purpose_outreach", data: ["demographics", "screening_history"], detail: `${summary.contacted} invitations, ${summary.responded} bookings` });
    const model = this.retrain({ quiet: true });
    this.emit({ type: "bandit", week: summary.week });
    return { summary, model };
  }

  // ---------------------------------------------------------------- ledger

  ledgerFor(user, from) {
    const filter = user.role === "family" ? (e) => e.hh === user.hh : user.role === "program" ? (e) => e.actor === "actor_adphc" : (e) => e.actor === "actor_clinician" || e.actor === "actor_clinic";
    return this.ledger.proofs(filter, { from });
  }
}

const clin = (i) => (i.status === "referral_pending" || i.status === "doctor_recommended" ? 1 : 0);
function ageOf(birth, ref) { return Math.floor((new Date(ref) - new Date(birth)) / (365.25 * 864e5)); }

export { SERVICES, CLINICS };
