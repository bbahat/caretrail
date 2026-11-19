// Mapping between CareTrail household records and FHIR R4 resources.
//
// toFhir(household) turns one household (the record shape the guideline
// engine reads) into FHIR resources: Group, Patient, Coverage, Condition,
// FamilyMemberHistory, Observation, Procedure, ServiceRequest, Consent and
// Encounter. fromFhir(group, resources) rebuilds the record from FHIR alone.
// The round trip is tested: the engine gives the same answer either way.
//
// fromFhir enforces consent at the data layer: genomic and wearable
// Observations are dropped unless the person's Consent permits them, so the
// engine never sees data it is not allowed to use.

import {
  EXT, CS, SNOMED, LOINC, V3_ROLE, V3_MARITAL, OBS_CAT, CONSENT_SCOPE, BASE,
  CONDITIONS, FAMILY, TOBACCO, LABS, WEAR, GENOMIC, HEMOGLOBIN, SNOMED_PROCEDURES,
  coding, cc, findCode, keyBySnomed,
} from "./codes.mjs";

const slug = (s) => String(s).replace(/_/g, "-");
const unslug = (s) => String(s).replace(/-/g, "_");
const ext = (name, value) => {
  if (value === undefined || value === null) return null;
  const t = typeof value;
  const key = t === "boolean" ? "valueBoolean" : t === "number" ? (Number.isInteger(value) ? "valueInteger" : "valueDecimal") : "valueString";
  return { url: EXT + name, [key]: value };
};
const exts = (...list) => list.filter(Boolean);
export const getExt = (res, name) => {
  const e = (res.extension || []).find((x) => x.url === EXT + name);
  if (!e) return undefined;
  return e.valueBoolean ?? e.valueInteger ?? e.valueDecimal ?? e.valueString ?? e.valueCode ?? e.valueDate;
};
const ref = (type, id) => ({ reference: `${type}/${id}` });
const refId = (r) => (r?.reference || "").split("/").pop();
const date = (s) => (s ? String(s).slice(0, 10) : null);
const addMonthsIso = (iso, m) => new Date(new Date(iso + "T00:00:00Z").getTime() + Math.round(m * 30.44) * 864e5).toISOString().slice(0, 10);
const qty = (value, unit) => ({ value, unit, system: "http://unitsofmeasure.org", code: unit });
const obsCat = (code) => [cc(OBS_CAT, code)];

function componentFor(name, v) {
  const c = { code: cc(`${BASE}/CodeSystem/field`, name) };
  if (typeof v === "boolean") c.valueBoolean = v;
  else if (typeof v === "number") Number.isInteger(v) ? (c.valueInteger = v) : (c.valueQuantity = { value: v });
  else c.valueString = String(v);
  return c;
}
function componentValue(c) {
  return c.valueBoolean ?? c.valueInteger ?? c.valueQuantity?.value ?? c.valueString;
}

// ------------------------------------------------------------------ toFhir

export function toFhir(hh) {
  const out = [];
  out.push({
    resourceType: "Group",
    id: hh.id,
    type: "person",
    actual: true,
    name: hh.label || `Household ${hh.id}`,
    extension: exts(
      ext("household-national", hh.national),
      ext("household-insurance", hh.insurance),
      ext("household-region", hh.region),
      ext("preferred-language", hh.preferred_language),
      ext("preferred-channel", hh.preferred_channel),
      ext("household-story", hh.story),
    ),
    member: hh.members.map((m) => ({ entity: ref("Patient", m.id) })),
  });
  for (const p of hh.members) out.push(...personToFhir(p, hh));
  return out;
}

function personToFhir(p, hh) {
  const out = [];
  const pid = p.id;
  const subject = ref("Patient", pid);
  out.push({
    resourceType: "Patient",
    id: pid,
    active: true,
    name: p.display_name ? [{ text: p.display_name, given: [p.display_name] }] : undefined,
    gender: p.sex,
    birthDate: p.birth_date,
    maritalStatus: p.married === undefined ? undefined : cc(V3_MARITAL, p.married ? "M" : "U"),
    extension: exts(
      ext("household-role", p.role),
      ext("person-kind", p.kind),
      ext("employment", p.employment),
      ext("parents-related", p.parents_related),
      ext("premature", p.premature),
      ext("unwilling-colonoscopy-or-fit", p.unwilling_colonoscopy_or_fit),
    ),
  });
  out.push({
    resourceType: "Coverage",
    id: `cov-${pid}`,
    status: "active",
    beneficiary: subject,
    type: { text: hh.insurance },
    payor: [{ display: hh.insurance === "Thiqa" ? "Thiqa programme" : `${hh.insurance} health insurance` }],
  });
  for (const c of p.conditions || []) {
    const [code, display] = CONDITIONS[c] || [null, c];
    out.push({
      resourceType: "Condition",
      id: `cond-${pid}-${slug(c)}`,
      subject,
      clinicalStatus: cc("http://terminology.hl7.org/CodeSystem/condition-clinical", "active"),
      code: code ? cc(SNOMED, code, display, c) : { text: c },
    });
  }
  for (const c of p.family_history || []) {
    const [code, display] = FAMILY[c] || [null, c];
    out.push({
      resourceType: "FamilyMemberHistory",
      id: `fmh-${pid}-${slug(c)}`,
      status: "completed",
      patient: subject,
      relationship: cc(V3_ROLE, "FAMMEMB", "family member"),
      condition: [{ code: code ? cc(SNOMED, code, display, c) : { text: c } }],
    });
  }
  if (p.tobacco) {
    const t = p.tobacco;
    const [code, display] = TOBACCO[t.status] || [null, null];
    out.push({
      resourceType: "Observation",
      id: `tob-${pid}`,
      status: "final",
      category: obsCat("social-history"),
      code: cc(LOINC, "72166-2", "Tobacco smoking status"),
      subject,
      effectiveDateTime: hh.reference_date || undefined,
      valueCodeableConcept: code ? cc(SNOMED, code, display, t.status) : { text: t.status },
      component: [
        t.types?.length ? componentFor("types", t.types.join(",")) : null,
        t.pack_years != null ? componentFor("pack_years", t.pack_years) : null,
        t.water_pipe_years != null ? componentFor("water_pipe_years", t.water_pipe_years) : null,
        t.years_since_quit != null ? componentFor("years_since_quit", t.years_since_quit) : null,
      ].filter(Boolean),
    });
  }
  for (const [cat, value] of Object.entries(p.consent || {})) {
    out.push({
      resourceType: "Consent",
      id: `consent-${pid}-${slug(cat)}`,
      status: "active",
      scope: cc(CONSENT_SCOPE, "patient-privacy"),
      category: [cc(CS.consent, cat)],
      patient: subject,
      dateTime: p.consent_dates?.[cat] || "2026-01-01",
      policyRule: { text: "CareTrail data-use consent" },
      provision: { type: value ? "permit" : "deny" },
    });
  }
  (p.genomic_findings || []).forEach((g, i) => {
    out.push({
      resourceType: "Observation",
      id: `gen-${pid}-${i}`,
      status: "final",
      category: obsCat("laboratory"),
      code: cc(LOINC, GENOMIC.loinc, GENOMIC.display),
      subject,
      valueCodeableConcept: { text: g },
      extension: exts(ext("data-category", "genomic")),
    });
  });
  if (p.wearable) {
    // Weekly means for 12 weeks; the last four weeks average to the summary.
    const hist = p._wearable_history || [];
    for (const [k, def] of Object.entries(WEAR)) {
      for (let w = 0; w < 12; w++) {
        const recent = w >= 8;
        let v = recent ? p.wearable[def.key] : hist[w]?.[def.key] ?? p.wearable[def.key];
        if (recent && p._wearable_jitter) v = +(v + p._wearable_jitter[k][w - 8]).toFixed(k === "sleep" ? 1 : 0);
        out.push({
          resourceType: "Observation",
          id: `wear-${pid}-${k}-${w}`,
          status: "final",
          category: obsCat("activity"),
          code: cc(LOINC, def.loinc, def.display),
          subject,
          effectivePeriod: { start: addMonthsIso(hh.reference_date || "2026-11-15", -(12 - w) * 7 / 30.44), end: addMonthsIso(hh.reference_date || "2026-11-15", -(11 - w) * 7 / 30.44) },
          valueQuantity: qty(v, def.unit),
          extension: exts(ext("data-category", "wearable"), ext("week-index", w)),
        });
      }
    }
  }
  for (const [lab, series] of Object.entries(p._labs || {})) {
    const def = LABS[lab];
    series.forEach((pt, i) => out.push({
      resourceType: "Observation",
      id: `lab-${pid}-${lab}-${i}`,
      status: "final",
      category: obsCat(lab === "sbp" || lab === "bmi" ? "vital-signs" : "laboratory"),
      code: cc(LOINC, def.loinc, def.display),
      subject,
      effectiveDateTime: pt.date,
      valueQuantity: qty(pt.value, def.unit),
    }));
  }
  for (const [pkg, rec] of Object.entries(p.screening || {})) {
    const code = cc(CS.package, pkg);
    if (rec.last_done) {
      out.push({
        resourceType: "Procedure",
        id: `scr-${pid}-${slug(pkg)}`,
        status: "completed",
        code,
        subject,
        performedDateTime: rec.last_done,
        outcome: rec.result ? cc(CS.result, rec.result) : undefined,
        extension: exts(ext("screening-modality", rec.modality)),
      });
    }
    if (rec.declined_on) {
      out.push({
        resourceType: "Procedure",
        id: `decl-${pid}-${slug(pkg)}`,
        status: "not-done",
        statusReason: { text: "Declined by the person" },
        code,
        subject,
        performedDateTime: rec.declined_on,
      });
    }
    if (rec.referral?.made) out.push(referralToFhir(pid, pkg, rec.referral, `Procedure/scr-${pid}-${slug(pkg)}`));
  }
  if (p.kind === "child") {
    if (p.newborn_hearing) {
      out.push({
        resourceType: "Observation",
        id: `nbh-${pid}`,
        status: "final",
        category: obsCat("exam"),
        code: cc(CS.wcvResult, "newborn-hearing", "Newborn hearing screen"),
        subject,
        valueString: p.newborn_hearing,
      });
    }
    for (const m of p.wcv?.attended_months || []) {
      out.push({
        resourceType: "Encounter",
        id: `wcv-${pid}-${m}`,
        status: "finished",
        class: coding("http://terminology.hl7.org/CodeSystem/v3-ActCode", "AMB", "ambulatory"),
        type: [cc(CS.wcvVisit, String(m), `Well-Child visit at ${m} months`)],
        subject,
        period: { start: addMonthsIso(p.birth_date, m) },
      });
    }
    for (const [key, r] of Object.entries(p.wcv?.results || {})) {
      const obs = {
        resourceType: "Observation",
        id: `wcvr-${pid}-${slug(key)}`,
        status: "final",
        category: obsCat(key === "cbc" ? "laboratory" : "survey"),
        code: { coding: [coding(CS.wcvResult, key), ...(key === "cbc" ? [coding(LOINC, HEMOGLOBIN.loinc, HEMOGLOBIN.display)] : [])] },
        subject,
        effectiveDateTime: r.done_on || undefined,
        component: Object.entries(r).filter(([f, v]) => f !== "done_on" && f !== "referral" && v !== null && v !== undefined).map(([f, v]) => componentFor(f, v)),
      };
      if (key === "cbc" && r.hb_g_dl != null) obs.valueQuantity = qty(r.hb_g_dl, "g/dL");
      out.push(obs);
      if (r.referral?.made) out.push(referralToFhir(pid, key, r.referral, `Observation/wcvr-${pid}-${slug(key)}`));
    }
  }
  return out;
}

export function referralToFhir(pid, key, r, reason, extra = {}) {
  return {
    resourceType: "ServiceRequest",
    id: `ref-${pid}-${slug(key)}`,
    status: r.completed ? "completed" : "active",
    intent: "order",
    category: [cc(SNOMED, "3457005", "Patient referral")],
    code: { text: r.specialist || "Specialist follow-up" },
    subject: ref("Patient", pid),
    authoredOn: r.made_on,
    reasonReference: reason ? [{ reference: reason }] : undefined,
    requester: r.requester ? { display: r.requester } : undefined,
    extension: exts(ext("screening-key", key), ext("completed-on", r.completed_on)),
    ...extra,
  };
}

// ------------------------------------------------------------------ fromFhir

export function fromFhir(group, resources, { enforceConsent = true } = {}) {
  const byPatient = new Map();
  for (const r of resources) {
    const pid = r.resourceType === "Patient" ? r.id : refId(r.subject || r.patient || r.beneficiary);
    if (!byPatient.has(pid)) byPatient.set(pid, []);
    byPatient.get(pid).push(r);
  }
  const hh = {
    id: group.id,
    label: group.name,
    national: getExt(group, "household-national"),
    insurance: getExt(group, "household-insurance"),
    region: getExt(group, "household-region"),
    preferred_language: getExt(group, "preferred-language"),
    preferred_channel: getExt(group, "preferred-channel"),
    story: getExt(group, "household-story"),
    members: [],
  };
  for (const m of group.member || []) {
    const pid = refId(m.entity);
    const list = byPatient.get(pid) || [];
    const pt = list.find((r) => r.resourceType === "Patient");
    if (!pt) continue;
    hh.members.push(personFromFhir(pt, list, hh, { enforceConsent }));
    if (!hh.insurance) hh.insurance = list.find((r) => r.resourceType === "Coverage")?.type?.text;
  }
  return hh;
}

function personFromFhir(pt, list, hh, { enforceConsent }) {
  const kind = getExt(pt, "person-kind") || "adult";
  const p = {
    id: pt.id,
    household: hh.id,
    role: getExt(pt, "household-role"),
    kind,
    sex: pt.gender,
    birth_date: pt.birthDate,
    conditions: [],
    consent: {},
  };
  if (pt.name?.[0]?.text) p.display_name = pt.name[0].text;
  const ms = findCode(pt.maritalStatus, V3_MARITAL);
  if (ms) p.married = ms === "M";
  for (const [k, n] of [["employment", "employment"], ["parents_related", "parents-related"], ["premature", "premature"], ["unwilling_colonoscopy_or_fit", "unwilling-colonoscopy-or-fit"]]) {
    const v = getExt(pt, n);
    if (v !== undefined) p[k] = v;
  }
  const of = (type) => list.filter((r) => r.resourceType === type);

  for (const c of of("Consent")) {
    const cat = findCode(c.category?.[0], CS.consent);
    if (cat) p.consent[cat] = c.status === "active" && c.provision?.type === "permit";
  }
  const allowed = (cat) => !enforceConsent || p.consent[cat] === true;

  for (const c of of("Condition")) {
    if (findCode(c.clinicalStatus, "http://terminology.hl7.org/CodeSystem/condition-clinical") === "resolved") continue;
    const key = keyBySnomed(CONDITIONS, findCode(c.code, SNOMED)) || c.code?.text;
    if (key) p.conditions.push(key);
  }
  if (kind === "adult") {
    p.family_history = of("FamilyMemberHistory").flatMap((f) => (f.condition || []).map((c) => keyBySnomed(FAMILY, findCode(c.code, SNOMED)) || c.code?.text)).filter(Boolean);
    p.genomic_findings = [];
    p.wearable = null;
    p.screening = {};
  }
  const obs = of("Observation");
  const tob = obs.find((o) => findCode(o.code, LOINC) === "72166-2");
  if (tob) {
    const comp = Object.fromEntries((tob.component || []).map((c) => [c.code.coding[0].code, componentValue(c)]));
    const status = keyBySnomed(TOBACCO, findCode(tob.valueCodeableConcept, SNOMED)) || tob.valueCodeableConcept?.text || "unknown";
    p.tobacco = {
      status,
      types: comp.types ? String(comp.types).split(",") : [],
      pack_years: comp.pack_years ?? 0,
      water_pipe_years: comp.water_pipe_years ?? 0,
      years_since_quit: comp.years_since_quit ?? null,
    };
  }
  if (allowed("genomic")) {
    p.genomic_findings = obs.filter((o) => findCode(o.code, LOINC) === GENOMIC.loinc).map((o) => o.valueCodeableConcept?.text).filter(Boolean);
  }
  const wearObs = obs.filter((o) => getExt(o, "data-category") === "wearable");
  if (wearObs.length && allowed("wearables")) {
    const series = {};
    for (const [k, def] of Object.entries(WEAR)) {
      series[k] = wearObs.filter((o) => findCode(o.code, LOINC) === def.loinc).sort((a, b) => getExt(a, "week-index") - getExt(b, "week-index")).map((o) => o.valueQuantity.value);
    }
    const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const last4 = (k) => series[k].slice(-4);
    p.wearable = {
      steps_per_day: Math.round(mean(last4("steps"))),
      sleep_hours: Math.round(mean(last4("sleep")) * 10) / 10,
      resting_hr: Math.round(mean(last4("rhr"))),
    };
    p.wearable_series = series;
  }
  const labs = {};
  for (const [k, def] of Object.entries(LABS)) {
    const pts = obs.filter((o) => findCode(o.code, LOINC) === def.loinc && o.effectiveDateTime).map((o) => ({ date: date(o.effectiveDateTime), value: o.valueQuantity.value }));
    if (pts.length) labs[k] = pts.sort((a, b) => a.date.localeCompare(b.date));
  }
  if (Object.keys(labs).length) p.labs = labs;

  for (const pr of of("Procedure")) {
    let pkg = findCode(pr.code, CS.package);
    let modality = getExt(pr, "screening-modality") ?? null;
    if (!pkg) {
      const s = SNOMED_PROCEDURES[findCode(pr.code, SNOMED)];
      if (!s) continue;
      pkg = s.pkg;
      modality = s.modality;
    }
    p.screening = p.screening || {};
    const rec = (p.screening[pkg] = p.screening[pkg] || { last_done: null, modality: null, result: null, referral: null });
    if (pr.status === "completed") {
      const when = date(pr.performedDateTime || pr.performedPeriod?.start);
      if (!rec.last_done || when > rec.last_done) {
        rec.last_done = when;
        rec.modality = modality;
        rec.result = findCode(pr.outcome, CS.result) || null;
      }
    } else if (pr.status === "not-done") {
      rec.declined_on = date(pr.performedDateTime);
    }
  }
  if (kind === "child") {
    const nbh = obs.find((o) => findCode(o.code, CS.wcvResult) === "newborn-hearing");
    if (nbh) p.newborn_hearing = nbh.valueString;
    p.wcv = {
      attended_months: of("Encounter").filter((e) => e.status === "finished").map((e) => +findCode(e.type?.[0], CS.wcvVisit)).filter((x) => !Number.isNaN(x)).sort((a, b) => a - b),
      results: {},
    };
    for (const o of obs) {
      const key = findCode(o.code, CS.wcvResult);
      if (!key || key === "newborn-hearing") continue;
      const r = { ...Object.fromEntries((o.component || []).map((c) => [c.code.coding[0].code, componentValue(c)])) };
      r.done_on = date(o.effectiveDateTime);
      p.wcv.results[key] = r;
    }
  }
  for (const sr of of("ServiceRequest")) {
    const key = getExt(sr, "screening-key");
    if (!key || sr.status === "revoked" || sr.status === "entered-in-error") continue;
    const referral = {
      made: true,
      made_on: date(sr.authoredOn),
      completed: sr.status === "completed",
      completed_on: getExt(sr, "completed-on") ?? null,
      ...(sr.requester?.display ? { requester: sr.requester.display } : {}),
      ...(sr.code?.text && sr.code.text !== "Specialist follow-up" ? { specialist: sr.code.text } : {}),
    };
    if (p.screening?.[key]) p.screening[key].referral = referral;
    else if (p.wcv?.results?.[key]) p.wcv.results[key].referral = referral;
  }
  return p;
}
