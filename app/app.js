// CareTrail web app: family passport, program view, and the data-use log.
// Everything runs in the browser on synthetic data. No network calls.

import { evaluateHousehold } from "../src/engine.js";
import { Ledger, hex } from "./ledger.js";
import {
  STR, NAMES_AR, itemTitle, factorText, compText, reasonText, driverText, segText, pkgShort, arAge,
} from "./i18n.js";

/* global RULES, DEMO, DASH */
const REF = DEMO.meta.reference_date;
const qs = new URLSearchParams(location.search);

const state = {
  lang: qs.get("lang") === "ar" ? "ar" : "en",
  view: ["family", "program", "how"].includes(qs.get("view")) ? qs.get("view") : "family",
  famId: qs.get("family") || "DEMO-1",
  tab: "steps",
  households: structuredClone(DEMO.households),
  open: {},       // expanded "why" panels
  showAll: false,
  booked: {},
  snoozed: {},
  modal: null,
  toast: null,
  verify: {},     // scope -> result
  tampered: null, // { index, original }
  computedFor: new Set(),
};

// ---------------------------------------------------------------- helpers

const t = (key, vars = {}) => {
  let s = key.split(".").reduce((o, k) => (o == null ? o : o[k]), STR[state.lang]);
  if (s == null) s = key.split(".").reduce((o, k) => (o == null ? o : o[k]), STR.en) ?? key;
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nm = (s) => (state.lang === "ar" ? NAMES_AR[s] || s : s);
const num = (n) => new Intl.NumberFormat(state.lang === "ar" ? "ar-AE-u-nu-latn" : "en-GB").format(n);
const loc = () => (state.lang === "ar" ? "ar-AE-u-nu-latn" : "en-GB");
const fmtDate = (s) => new Intl.DateTimeFormat(loc(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(s.length === 10 ? s + "T00:00:00Z" : s));
const fmtSlot = (s) => new Intl.DateTimeFormat(loc(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(s));
const addDays = (iso, n) => new Date(new Date(iso + "T00:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10);
const nowStamp = () => `${REF}T${new Date().toISOString().slice(11, 19)}Z`;

const household = () => state.households.find((h) => h.id === state.famId) || state.households[0];
const manager = (hh) => hh.members.find((m) => m.kind === "adult") || hh.members[0];
const roleOf = (p) => (p.kind === "child" ? (p.sex === "female" ? "daughter" : "son") : p.role);
function ageLabel(p) {
  const days = (new Date(REF) - new Date(p.birth_date)) / 864e5;
  if (days < 730) {
    const m = Math.floor(days / 30.44);
    return state.lang === "ar" ? arAge(Math.max(m, 1)) : t("age_m", { n: m });
  }
  return t("age_y", { n: Math.floor(days / 365.25) });
}
const isPrivate = (p, hh) => p.kind === "adult" && p.id !== manager(hh).id && p.consent?.share_with_household === false;

const ICON = {
  1: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><rect x="7.1" y="3.6" width="1.8" height="5.6" rx=".9" fill="var(--surface)"/><circle cx="8" cy="11.6" r="1.1" fill="var(--surface)"/></svg>',
  2: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 15 14H1z" fill="currentColor"/><path d="M8 6v4" stroke="var(--surface)" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="12" r=".9" fill="var(--surface)"/></svg>',
  3: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 4.6V8l2.4 1.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  4: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.8" y="3" width="12.4" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M1.8 6.6h12.4M5 1.6v3M11 1.6v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  5: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor"/></svg>',
  ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="m4.8 8.2 2.2 2.2 4.2-4.6" fill="none" stroke="var(--surface)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6.4 5.6v4.8M9.6 5.6v4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 7.2v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="4.9" r="1" fill="currentColor"/></svg>',
  lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.4" rx="1.6" fill="currentColor"/><path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  shield: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.4 13.6 3.6v4c0 3.4-2.4 5.8-5.6 7-3.2-1.2-5.6-3.6-5.6-7v-4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m5.6 8 1.7 1.7L10.6 6.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const statusIcon = (it) =>
  it.tier ? ICON[it.tier] : it.status === "up_to_date" ? ICON.ok : it.status === "declined" ? ICON.pause : it.status === "not_eligible" ? ICON.lock : ICON.info;
const statusClass = (it) => (it.tier ? `t${it.tier}` : it.status === "up_to_date" ? "ok" : "neutral");
const statusLabel = (it) => (it.tier && it.tier <= 4 ? t(`tier.${it.tier}`) : t(`status.${it.status}`));

// ---------------------------------------------------------------- ledger

const ledger = new Ledger();
const ACT = {
  en: {
    result_received: "Result received from {facility}",
    referral_created: "Referral created to {to}",
    program_view: "Viewed screening status",
    declined: "Postponed {what}",
    computed: "Next steps computed",
    consent: "Consent changed: {what} {state}",
    booking: "Booking requested: {what}",
    snoozed: "Reminder snoozed: {what}",
    pseud_open: "Opened pseudonymous record {p}",
    actor_lab: "Network laboratory (via Malaffi, simulated)",
    actor_adphc: "ADPHC screening team",
    actor_app: "CareTrail app",
    actor_clinic: "Primary care clinic",
    purpose_result: "Deliver result to the record",
    purpose_referral: "Refer for follow-up",
    purpose_program: "Close an open follow-up",
    purpose_compute: "Personal reminders. Data stayed on this device.",
    purpose_consent: "Person's own choice",
    purpose_booking: "Book a screening",
  },
  ar: {
    result_received: "استلام نتيجة من {facility}",
    referral_created: "إنشاء تحويل إلى {to}",
    program_view: "الاطلاع على حالة الفحص",
    declined: "تأجيل {what}",
    computed: "حساب الخطوات التالية",
    consent: "تغيير الموافقة: {what} {state}",
    booking: "طلب حجز: {what}",
    snoozed: "تأجيل التذكير: {what}",
    pseud_open: "فتح سجل مستعار {p}",
    actor_lab: "مختبر الشبكة (عبر ملفّي، محاكاة)",
    actor_adphc: "فريق الفحص في مركز أبوظبي للصحة العامة",
    actor_app: "تطبيق كير ترِيل",
    actor_clinic: "عيادة الرعاية الأولية",
    purpose_result: "إضافة النتيجة إلى السجل",
    purpose_referral: "التحويل للمتابعة",
    purpose_program: "إغلاق متابعة مفتوحة",
    purpose_compute: "تذكيرات شخصية. بقيت البيانات على هذا الجهاز.",
    purpose_consent: "اختيار الشخص نفسه",
    purpose_booking: "حجز فحص",
  },
};
const a = (k, v = {}) => (ACT[state.lang][k] || ACT.en[k] || k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "");

function entryText(e) {
  const who = (id) => {
    const p = state.households.flatMap((h) => h.members).find((m) => m.id === id);
    return p ? nm(p.display_name) : id;
  };
  const what = e.key ? pkgShort(e.key, state.lang) : "";
  const consentName = { genomic: t("c_genomic"), wearables: t("c_wearables"), share_with_household: t("c_share") }[e.consent] || "";
  let action = "";
  switch (e.action) {
    case "result_received": action = a("result_received", { facility: state.lang === "ar" ? "مختبر الشبكة" : "network laboratory" }); break;
    case "referral_created": action = a("referral_created", { to: state.lang === "ar" ? "عيادة النمو العصبي" : "neurodevelopment clinic" }); break;
    case "program_view": action = a("program_view"); break;
    case "declined": action = a("declined", { what }); break;
    case "computed": action = a("computed"); break;
    case "consent": action = a("consent", { what: consentName, state: e.value ? t("on") : t("off") }); break;
    case "booking": action = a("booking", { what }); break;
    case "snoozed": action = a("snoozed", { what }); break;
    case "pseud_open": action = a("pseud_open", { p: e.subject }); break;
  }
  const actor = e.actor.startsWith("person:") ? who(e.actor.slice(7)) : a(e.actor);
  const purpose = e.purpose.startsWith("purpose_") && STR.en[e.purpose] ? t(e.purpose) : a(e.purpose);
  const subj = e.subject && !e.subject.startsWith("P-") ? who(e.subject) : null;
  return { action, actor, purpose, subj };
}

async function seedLedger() {
  await ledger.appendMany([
    { ts: "2026-05-20T10:12:00Z", hh: "DEMO-2", subject: "DEMO-2-03", actor: "actor_clinic", action: "referral_created", purpose: "purpose_referral", data: ["screening_history"], key: "mchat_18" },
    { ts: "2026-08-03T17:40:00Z", hh: "DEMO-3", subject: "DEMO-3-01", actor: "person:DEMO-3-01", action: "declined", purpose: "purpose_consent", data: ["screening_history"], key: "female_repro" },
    { ts: "2026-10-21T08:05:00Z", hh: "DEMO-1", subject: "DEMO-1-02", actor: "actor_lab", action: "result_received", purpose: "purpose_result", data: ["screening_history"], key: "major" },
    { ts: "2026-11-02T09:31:00Z", hh: "DEMO-1", subject: "DEMO-1-02", actor: "actor_adphc", action: "program_view", purpose: "purpose_program", data: ["demographics", "screening_history"], key: "major" },
    { ts: "2026-11-09T11:02:00Z", hh: "DEMO-2", subject: "DEMO-2-03", actor: "actor_adphc", action: "program_view", purpose: "purpose_program", data: ["demographics", "screening_history"], key: "mchat_18" },
  ]);
}

async function log(entry) {
  const i = await ledger.append({ ts: nowStamp(), data: [], ...entry });
  state.verify = {};
  return i;
}

// ---------------------------------------------------------------- views

function header() {
  const v = (id, label) => `<button class="seg ${state.view === id ? "on" : ""}" data-act="view" data-v="${id}" aria-pressed="${state.view === id}">${label}</button>`;
  return `<header class="top">
    <div class="brand">
      <svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M7 30c6-1 7-9 13-10s8-9 13-10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="1 5.2"/><circle cx="7" cy="30" r="4" fill="currentColor"/><circle cx="20" cy="20" r="4" fill="currentColor"/><circle cx="33" cy="10" r="5.4" fill="var(--accent)"/><path d="m30.8 10 1.6 1.6 3-3.2" fill="none" stroke="var(--surface)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div><div class="name">CareTrail</div><div class="tag">${t("app_tag")}</div></div>
    </div>
    <nav class="views" aria-label="View">${v("family", t("view_family"))}${v("program", t("view_program"))}${v("how", t("view_how"))}</nav>
    <div class="right">
      <span class="badge-syn">${t("synthetic")}</span>
      <button class="lang" data-act="lang" lang="${state.lang === "ar" ? "en" : "ar"}">${t("lang_switch")}</button>
    </div>
  </header>`;
}

function stamps(hh, res) {
  return `<div class="stamps" role="list">${res.members.map((m) => {
    const p = m.person;
    const priv = isPrivate(p, hh);
    const tiers = priv ? [] : m.items.filter((i) => i.tier && i.tier <= 4 && !state.snoozed[i.id]).map((i) => i.tier);
    const best = tiers.length ? Math.min(...tiers) : null;
    const notCov = !priv && !best && m.items.length > 0 && m.items.every((i) => i.status === "not_eligible");
    const cls = priv || notCov ? "neutral" : best ? `t${best}` : "ok";
    const label = priv ? t("status.info") : notCov ? t("status.not_eligible") : best ? t(`tier.${best}`) : t("up_to_date");
    return `<button class="stamp ${cls}" role="listitem" data-act="member" data-id="${p.id}" aria-label="${esc(nm(p.display_name))}: ${esc(label)}">
      <span class="ring"><span class="init">${esc(nm(p.display_name)).slice(0, 1)}</span><span class="dot">${priv ? ICON.lock : notCov ? ICON.info : best ? ICON[best] : ICON.ok}</span></span>
      <span class="sn">${esc(nm(p.display_name))}</span><span class="sr">${t(`role.${roleOf(p)}`)} · ${ageLabel(p)}</span>
    </button>`;
  }).join("")}</div>`;
}

function whyPanel(it) {
  const f = it.factors || [];
  const comps = it.components?.length ? `<div class="why-block"><h4>${t("components_at_visit")}</h4><ul class="comps">${it.components.map((c) => `<li>${esc(compText(c, state.lang))}</li>`).join("")}</ul></div>` : "";
  return `<div class="why" id="why-${esc(it.id)}">
    <div class="why-block"><h4>${t("factors")}</h4>${f.length ? `<ul class="factors">${f.map((x) => `<li><span class="cat">${t(`cat.${x.category}`)}</span>${esc(factorText(x, state.lang))}</li>`).join("")}</ul>` : `<p class="muted">${t("no_factors")}</p>`}</div>
    ${comps}
    <div class="why-block"><h4>${t("data_used")}</h4><div class="chips">${(it.dataUsed || []).map((c) => `<span class="chip">${t(`cat.${c}`)}</span>`).join("")}</div></div>
    <div class="why-block"><h4>${t("source")}</h4><p class="src">${esc(it.source)} · ${it.program === "WCV" ? "DoH Well-Child Visit Standard V10 (Dec 2025)" : "DoH IFHAS Standard V10 (Jul 2025)"}</p></div>
    ${it.decision === "clinical" ? `<p class="clin">${ICON.info}<span>${t("clinical_note")}</span></p>` : ""}
  </div>`;
}

function stepCard(it) {
  const open = !!state.open[it.id];
  const booked = state.booked[it.id];
  return `<article class="step ${statusClass(it)}">
    <div class="step-head"><span class="badge ${statusClass(it)}">${statusIcon(it)}${statusLabel(it)}</span><span class="who">${esc(nm(it.personName))}</span></div>
    <h3>${esc(itemTitle(it, state.lang))}</h3>
    <p class="reason">${(it.reasons || []).map((r) => esc(reasonText(r, state.lang, fmtDate))).join(" ")}</p>
    <div class="chips"><span class="chip ${it.decision === "clinical" ? "clinical" : ""}">${t(`decision_${it.decision}`)}</span></div>
    ${booked ? `<p class="booked">${ICON.ok}<span>${t("booked", { slot: fmtSlot(booked) })}</span></p>` : ""}
    <div class="acts">
      ${booked ? "" : `<button class="btn primary" data-act="book" data-id="${esc(it.id)}">${t("book")}</button><button class="btn" data-act="snooze" data-id="${esc(it.id)}">${t("not_now")}</button>`}
      <button class="btn link" data-act="why" data-id="${esc(it.id)}" aria-expanded="${open}" aria-controls="why-${esc(it.id)}">${open ? t("hide_why") : t("why")}</button>
    </div>
    ${open ? whyPanel(it) : ""}
  </article>`;
}

function familySteps(hh, res) {
  const mgr = manager(hh);
  const visible = res.actions.filter((i) => !state.snoozed[i.id] && !isPrivate(i.person || res.members.find((m) => m.person.id === i.personId).person, hh));
  const shown = state.showAll ? visible : visible.slice(0, 3);
  const extra = visible.length - 3;
  const notes = [];
  if (hh.insurance !== "Thiqa") notes.push(`<aside class="note">${ICON.info}<div><strong>${t("not_covered_title")}</strong><p>${t("not_covered_body")}</p></div></aside>`);
  if (!["ar", "en"].includes(hh.preferred_language)) notes.push(`<aside class="note">${ICON.info}<div><p>${t("lang_note_ur")}</p></div></aside>`);
  const priv = res.members.filter((m) => isPrivate(m.person, hh));
  priv.forEach((m) => notes.push(`<aside class="note">${ICON.lock}<div><strong>${t("private_member", { name: esc(nm(m.person.display_name)) })}</strong><p>${t("private_body", { name: esc(nm(m.person.display_name)) })}</p></div></aside>`));
  const wear = hh.members.filter((p) => p.kind === "adult" && !isPrivate(p, hh) && p.consent?.wearables && p.wearable);
  const wearCard = wear.map((p) => `<section class="well">
      <h3>${t("wellbeing_title")} · ${esc(nm(p.display_name))}</h3>
      <div class="well-stats"><div><b>${num(p.wearable.steps_per_day)}</b><span>${t("steps_day", { n: "" }).trim()}</span></div><div><b>${num(p.wearable.sleep_hours)}</b><span>${state.lang === "ar" ? "ساعات نوم" : "h sleep"}</span></div><div><b>${num(p.wearable.resting_hr)}</b><span>${state.lang === "ar" ? "نبض الراحة" : "resting HR"}</span></div></div>
      <p>${t("wellbeing_tip")}</p><p class="muted small">${t("wellbeing_shared")}</p>
    </section>`).join("");
  return `
    <p class="hello">${t("hello", { name: esc(nm(mgr.display_name)) })}</p>
    <p class="muted">${t("you_manage", { n: num(hh.members.length) })}</p>
    ${stamps(hh, res)}
    <h2 class="steps-title">${visible.length ? t("steps_title_n", { n: num(Math.min(3, visible.length)) }) : t("steps_title_0")}</h2>
    <p class="muted small">${t("steps_sub")}</p>
    <div class="steps">${shown.map(stepCard).join("")}</div>
    ${extra > 0 ? `<button class="btn more" data-act="more">${state.showAll ? t("fewer_steps") : t("more_steps", { n: num(extra) })}</button>` : ""}
    ${notes.join("")}
    ${wearCard}`;
}

function visitTrail(p) {
  const sched = RULES.wcv.schedule_months;
  const m = (new Date(REF) - new Date(p.birth_date)) / 864e5 / 30.44;
  const attended = new Set(p.wcv?.attended_months || []);
  const current = Math.max(...sched.filter((x) => x <= m));
  return `<div class="trail" aria-label="${t("visit_trail")}">
    <h4>${t("visit_trail")}</h4>
    <ol>${sched.map((x) => {
      const st = attended.has(x) ? "att" : x < current ? "miss" : x === current ? "now" : "fut";
      const lab = x < 24 || x % 12 ? t("months_short", { n: x }) : t("years_short", { n: x / 12 });
      const name = { att: t("attended"), miss: t("missed"), now: t("due_now"), fut: t("upcoming") }[st];
      return `<li class="${st}" title="${esc(lab)}: ${esc(name)}"><span class="pip"></span><span class="lab">${lab}</span></li>`;
    }).join("")}</ol>
    <div class="legend"><span class="att">${t("attended")}</span><span class="miss">${t("missed")}</span><span class="now">${t("due_now")}</span><span class="fut">${t("upcoming")}</span></div>
  </div>`;
}

function passport(hh, res) {
  return `<h2>${t("passport_title")}</h2>${res.members.map((m) => {
    const p = m.person;
    const head = `<header><span class="avatar">${esc(nm(p.display_name)).slice(0, 1)}</span><div><h3>${esc(nm(p.display_name))}</h3><p class="muted small">${t(`role.${roleOf(p)}`)} · ${ageLabel(p)} · ${t(`insurance.${hh.insurance}`)}</p></div></header>`;
    if (isPrivate(p, hh)) return `<section class="member" id="m-${p.id}">${head}<p class="muted">${ICON.lock} ${t("private_body", { name: esc(nm(p.display_name)) })}</p></section>`;
    const groups = [
      [t("needs_action"), m.items.filter((i) => i.tier && i.tier <= 4)],
      [t("tier.5"), m.items.filter((i) => i.tier === 5)],
      [t("up_to_date"), m.items.filter((i) => i.status === "up_to_date")],
      [t("other"), m.items.filter((i) => !i.tier && i.status !== "up_to_date")],
    ].filter(([, l]) => l.length);
    const row = (i) => `<li class="prow"><span class="badge ${statusClass(i)}">${statusIcon(i)}${statusLabel(i)}</span><div><b>${esc(itemTitle(i, state.lang))}</b><span class="muted small">${(i.reasons || []).map((r) => esc(reasonText(r, state.lang, fmtDate))).join(" ")}${state.snoozed[i.id] ? " · " + t("snoozed", { date: fmtDate(state.snoozed[i.id]) }) : ""}</span></div></li>`;
    return `<section class="member" id="m-${p.id}">${head}
      ${p.kind === "child" ? visitTrail(p) : ""}
      ${groups.length ? groups.map(([g, l]) => `<h4 class="grp">${g}</h4><ul class="plist">${l.map(row).join("")}</ul>`).join("") : `<p class="muted">${t("no_items")}</p>`}
    </section>`;
  }).join("")}`;
}

function toggle(p, key, disabled = false) {
  const on = key === "program_screening" ? true : !!p.consent?.[key];
  return `<label class="tog ${disabled ? "dis" : ""}">
    <span class="tl"><b>${t(`c_${key === "share_with_household" ? "share" : key}`)}</b><span class="muted small">${t(`c_${key === "share_with_household" ? "share" : key}_d`)}</span></span>
    <input type="checkbox" role="switch" ${on ? "checked" : ""} ${disabled ? "disabled" : ""} data-act="consent" data-id="${p.id}" data-k="${key}">
    <span class="sw" aria-hidden="true"></span>
  </label>`;
}

function logPanel(scope, filter, title) {
  const v = state.verify[scope];
  const cp = ledger.checkpoint;
  const entries = ledger.entries.filter(filter).slice().reverse();
  const banner = v ? (v.running ? `<p class="vres">${t("verifying")}</p>` :
    v.ok ? `<p class="vres ok">${ICON.shield}<span>${t("verified_ok", { n: num(v.checked) })}</span></p>` :
    `<p class="vres bad">${ICON[1]}<span>${t("verified_bad", { i: v.badIndex ?? "?" })}</span></p>`) : "";
  return `<section class="log">
    <h3>${title}</h3><p class="muted small">${t("log_sub")}</p>
    <dl class="cp"><div><dt>${t("log_size")}</dt><dd>${num(cp.size)}</dd></div><div><dt>${t("log_root")}</dt><dd class="mono">${hex(cp.root).slice(0, 16)}…</dd></div><div><dt>${t("log_sig")}</dt><dd class="mono">${ledger.alg ? `${ledger.alg} · ${cp.sig ? hex(cp.sig).slice(0, 12) + "…" : ""}` : t("sig_unavailable")}</dd></div></dl>
    <div class="acts"><button class="btn primary" data-act="verify" data-scope="${scope}">${t("verify")}</button>
    ${state.tampered ? `<button class="btn" data-act="restore" data-scope="${scope}">${t("restore")}</button>` : `<button class="btn" data-act="tamper" data-scope="${scope}">${t("tamper")}</button>`}</div>
    ${state.tampered ? `<p class="muted small">${t("tampered", { i: state.tampered.index })}</p>` : ""}
    ${banner}
    <ol class="entries">${entries.map((e) => {
      const x = entryText(e);
      return `<li class="${state.tampered?.index === e.i ? "edited" : ""}">
        <div class="eh"><span class="mono">#${e.i}</span><span>${fmtDate(e.ts)}</span><span class="mono muted">${t("leaf")} ${ledger.leafHex(e.i).slice(0, 10)}</span></div>
        <b>${esc(x.action)}${x.subj ? " · " + esc(x.subj) : ""}</b>
        <span class="small">${t("actor")}: ${esc(x.actor)}</span>
        <span class="small">${t("purpose")}: ${esc(x.purpose)}</span>
        ${e.data?.length ? `<span class="small">${t("data")}: ${e.data.map((c) => t(`cat.${c}`)).join(", ")}</span>` : ""}
      </li>`;
    }).join("")}</ol>
  </section>`;
}

function privacy(hh) {
  return `<h2>${t("privacy_title")}</h2><p class="muted">${t("privacy_sub")}</p>
    ${hh.members.map((p) => `<section class="member consent"><header><span class="avatar">${esc(nm(p.display_name)).slice(0, 1)}</span><div><h3>${esc(nm(p.display_name))}</h3><p class="muted small">${t(`role.${roleOf(p)}`)} · ${ageLabel(p)}</p></div></header>
      ${toggle(p, "program_screening", true)}
      ${p.kind === "adult" ? toggle(p, "genomic") + toggle(p, "wearables") + (p.id !== manager(hh).id ? toggle(p, "share_with_household") : "") : `<p class="muted small">${t("child_always")}</p>`}
    </section>`).join("")}`;
}

function tryPanel() {
  const steps = state.lang === "ar"
    ? ["افتح «لماذا؟» على متابعة خالد المفتوحة: السبب والمصدر ومن يقرر.", "في «الخصوصية» أوقف بيانات الجهاز لمريم: تتغير الأسباب فورًا.", "في «سجل البيانات» اضغط «تحقق من السجل»، ثم «محاكاة التلاعب» وتحقق مرة أخرى.", "جرّب عائلة خان: إحالة توحد عالقة وعائلة خارج ثقة.", "افتح «لوحة البرنامج» وافتح سجلًا من قائمة التواصل: يظهر في السجل."]
    : ["Open “Why this?” on Khalid's open follow-up: reason, source, and who decides.", "In Privacy, switch off Mariam's wearable data: the reasons update at once.", "In Data log, press Verify log, then Simulate tampering and verify again.", "Try the Khan family: a stuck autism referral and adults outside Thiqa.", "Open the Program view and open a record from the outreach queue: it lands in the log."];
  return `<aside class="try"><h3>${state.lang === "ar" ? "جرّبه في دقيقتين" : "Try it in two minutes"}</h3><ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol>
  <p class="muted small">${state.lang === "ar" ? "تاريخ المرجع" : "Reference date"}: ${fmtDate(REF)}</p></aside>`;
}

function familyView() {
  const hh = household();
  const res = evaluateHousehold(hh, RULES, REF);
  res.actions.forEach((i) => (i.person = res.members.find((m) => m.person.id === i.personId).person));
  if (!state.computedFor.has(hh.id)) {
    state.computedFor.add(hh.id);
    log({ hh: hh.id, subject: null, actor: "actor_app", action: "computed", purpose: "purpose_compute", data: [...new Set(res.members.flatMap((m) => m.dataUsed))] }).then(render);
  }
  const tab = (id, label) => `<button role="tab" class="tab ${state.tab === id ? "on" : ""}" aria-selected="${state.tab === id}" data-act="tab" data-v="${id}">${label}</button>`;
  const body = state.tab === "steps" ? familySteps(hh, res) : state.tab === "passport" ? passport(hh, res) : state.tab === "privacy" ? privacy(hh) : logPanel(hh.id, (e) => e.hh === hh.id, t("log_title"));
  return `<div class="family-wrap">
    <div class="phone">
      <div class="fam-bar">
        <label class="fam-pick"><span class="muted small">${t("demo_family")}</span>
          <select data-act="family">${state.households.map((h) => `<option value="${h.id}" ${h.id === hh.id ? "selected" : ""}>${esc(nm(h.label))} · ${t(`insurance.${h.insurance}`)} · ${t(`region.${h.region}`)}</option>`).join("")}</select>
        </label>
      </div>
      <div class="tabs" role="tablist">${tab("steps", t("tab_steps"))}${tab("passport", t("tab_passport"))}${tab("privacy", t("tab_privacy"))}${tab("log", t("tab_log"))}</div>
      <div class="screen">${body}</div>
    </div>
    ${tryPanel()}
  </div>`;
}

// ---------------------------------------------------------------- program view

function barsChart(rows, { max = 100, target = null, fmt = (v) => `${v}%`, tip, W = 560, labW = 168 }) {
  const rowH = 26, padR = 52, H = rows.length * rowH + 22;
  const x = (v) => labW + (v / max) * (W - labW - padR);
  const rtl = state.lang === "ar";
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="direction:ltr">
    ${[0, 0.25, 0.5, 0.75, 1].map((f) => f * max).map((g) => `<line x1="${x(g)}" x2="${x(g)}" y1="0" y2="${H - 18}" class="grid"/><text x="${x(g)}" y="${H - 4}" class="axis" text-anchor="middle">${g}</text>`).join("")}
    ${rows.map((r, i) => {
      const y = i * rowH + 4;
      return `<g class="hov" data-tip="${esc(tip(r))}">
        <rect x="0" y="${y - 2}" width="${W}" height="${rowH}" fill="transparent"/>
        <text x="${labW - 10}" y="${y + 14}" class="lab" text-anchor="end" ${rtl ? 'direction="rtl"' : ""}>${esc(r.label)}</text>
        <rect x="${labW}" y="${y + 4}" width="${Math.max(2, x(r.value) - labW)}" height="14" rx="4" class="bar ${r.cls || ""}"/>
        <text x="${x(r.value) + 6}" y="${y + 15}" class="val">${esc(fmt(r.value))}</text>
      </g>`;
    }).join("")}
    ${target != null ? `<line x1="${x(target)}" x2="${x(target)}" y1="0" y2="${H - 18}" class="target"/>` : ""}
  </svg>`;
}

function calChart(cal) {
  const W = 300, H = 230, p = 36;
  const sx = (v) => p + v * (W - p - 10), sy = (v) => H - p - v * (H - p - 10);
  const pts = cal.filter((c) => c.observed != null);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("m_cal")}" style="direction:ltr">
    ${[0, 0.25, 0.5, 0.75, 1].map((g) => `<line x1="${sx(g)}" x2="${sx(g)}" y1="${sy(0)}" y2="${sy(1)}" class="grid"/><line x1="${sx(0)}" x2="${sx(1)}" y1="${sy(g)}" y2="${sy(g)}" class="grid"/><text x="${sx(g)}" y="${H - p + 16}" class="axis" text-anchor="middle">${g}</text><text x="${p - 6}" y="${sy(g) + 4}" class="axis" text-anchor="end">${g}</text>`).join("")}
    <line x1="${sx(0)}" y1="${sy(0)}" x2="${sx(1)}" y2="${sy(1)}" class="diag"/>
    <polyline points="${pts.map((c) => `${sx(c.mean_predicted)},${sy(c.observed)}`).join(" ")}" class="line"/>
    ${pts.map((c) => `<circle cx="${sx(c.mean_predicted)}" cy="${sy(c.observed)}" r="5" class="pt hov" data-tip="${esc(`${t("m_pred")} ${c.mean_predicted} · ${t("m_obs")} ${c.observed} · n=${c.n}`)}"/>`).join("")}
    <text x="${sx(0.5)}" y="${H - 2}" class="axis" text-anchor="middle">${t("m_pred")}</text>
    <text x="10" y="${sy(0.5)}" class="axis" text-anchor="middle" transform="rotate(-90 10 ${sy(0.5)})">${t("m_obs")}</text>
  </svg>`;
}

function programView() {
  const D = DASH;
  const major = D.kpis.ifhas.find((k) => k.package === "major");
  const refRows = D.kpis.ifhas.filter((k) => k.referral_on_time_pct != null && k.abnormal_n >= D.meta.min_cell);
  const refOn = Math.round(refRows.reduce((s, k) => s + k.referral_on_time_pct * k.abnormal_n, 0) / refRows.reduce((s, k) => s + k.abnormal_n, 0) * 10) / 10;
  const kpi = (v, l, d, cls = "") => `<div class="kpi ${cls}"><b>${v}</b><span>${l}</span>${d ? `<small>${d}</small>` : ""}</div>`;
  const partRows = D.kpis.ifhas.filter((k) => k.eligible >= D.meta.min_cell).map((k) => ({
    label: pkgShort(k.package, state.lang), value: k.participation_pct, n: k.eligible, cls: k.participation_pct >= k.target_pct ? "met" : "",
  }));
  const sim = D.simulation;
  const tierOnly = sim.find((s) => s.policy.startsWith("Clinical tier"));
  const ct = sim.find((s) => s.policy === "CareTrail prioritisation");
  const coefs = D.model.coefficients.slice(0, 8);
  const cmax = Math.max(...coefs.map((c) => Math.abs(c.coef)));
  const segs = D.safeguards;
  const q = D.queue;

  return `<div class="program">
    <section class="p-head"><h2>${t("p_title")}</h2><p class="muted">${t("p_sub", { people: num(D.meta.people), hh: num(D.meta.households), date: fmtDate(D.meta.reference_date) })}</p></section>
    <section class="kpis">
      ${kpi(num(D.care_gaps.people_with_gaps), t("k_gaps"), "")}
      ${kpi(num(D.care_gaps.people_with_open_loops), t("k_open"), t("k_open_d"), "warn")}
      ${kpi(`${num(major.participation_pct)}%`, t("k_part"), t("k_part_d", { t: major.target_pct }))}
      ${kpi(`${num(refOn)}%`, t("k_ref"), t("k_ref_d", { t: 100 }), "warn")}
    </section>
    <div class="pgrid">
      <section class="card wide"><h3>${t("c_part_title")}</h3><p class="muted small">${t("c_part_sub", { t: major.target_pct })}</p>
        <div class="tscroll"><div class="wchart">${barsChart(partRows, { target: major.target_pct, tip: (r) => `${r.label}: ${r.value}% · ${t("eligible_n", { n: num(r.n) })}</div></div>`, W: 1100, labW: 190 })}
      </section>
      <section class="card"><h3>${t("c_sim_title")}</h3><p class="muted small">${t("c_sim_sub", { n: num(ct.contacted) })}</p>
        ${barsChart(sim.map((s) => ({ label: t(`policy.${s.policy}`), value: s.expected_open_loops_closed, cls: s.policy === "CareTrail prioritisation" ? "em" : "", s })), { max: 400, W: 560, labW: 230, fmt: (v) => num(v), tip: (r) => `${r.label}: ${num(r.value)} · ${state.lang === "ar" ? "فحوص مكتملة" : "completions"} ${num(r.s.expected_completions)}` })}
        <p class="small">${t("c_sim_note", { a: num(tierOnly.open_loops_gain_vs_broad), b: num(ct.expected_completions - tierOnly.expected_completions) })}</p>
      </section>
      <section class="card"><h3>${t("m_title")}</h3><p class="purpose">${ICON.info}<span>${t("m_purpose")}</span></p>
        <dl class="mc">
          <div><dt>${t("m_type")}</dt><dd>${state.lang === "ar" ? "انحدار لوجستي بمتغيرات معيارية" : esc(D.model.type)}</dd></div>
          <div><dt>${t("m_target")}</dt><dd>${state.lang === "ar" ? "عدم إكمال الفحص خلال 90 يومًا من الدعوة" : esc(D.model.target)}</dd></div>
          <div><dt>${t("m_scored")}</dt><dd>${num(D.model.n_scored)} · ${t("m_unscored")}: ${num(D.model.n_insufficient_history)}</dd></div>
          <div><dt>${t("m_auc")} · ${t("m_brier")} · ${t("m_ece")}</dt><dd class="mono">${D.model.auc} · ${D.model.brier} · ${D.model.ece}</dd></div>
        </dl>
        <h4>${t("m_cal")}</h4><div class="calwrap">${calChart(D.model.calibration)}</div>
        <h4>${t("m_drivers")}</h4>
        <ul class="drivers">${coefs.map((c) => `<li><span>${esc(driverText(c.label, state.lang))}</span><span class="dbar"><i class="${c.coef > 0 ? "up" : "down"}" style="width:${(Math.abs(c.coef) / cmax) * 100}%"></i></span><span class="small muted">${c.coef > 0 ? t("m_raises") : t("m_lowers")}</span></li>`).join("")}</ul>
      </section>
      <section class="card wide"><h3>${t("s_title")}</h3><p class="muted small">${t("s_sub", { k: D.meta.min_cell })}</p>
        <div class="tscroll"><table><thead><tr><th>${t("s_seg")}</th><th class="n">${t("s_n")}</th><th class="n">${t("s_rec")}</th><th class="n">${t("s_uptake")}</th><th class="n">${t("s_gap")}</th><th>${t("s_flag")}</th></tr></thead>
        <tbody>${segs.map((s) => `<tr><td>${esc(segText(s.segment, state.lang))}: <b>${esc(segText(s.group, state.lang))}</b></td>
          ${s.suppressed ? `<td class="n" colspan="4">${t("s_supp")}</td>` : `<td class="n">${num(s.n)}</td><td class="n">${num(s.recommended_pct)}%</td><td class="n">${num(s.baseline_uptake_pct)}%</td><td class="n">${s.calibration_gap_pts > 0 ? "+" : ""}${num(s.calibration_gap_pts)}</td>`}
          <td>${s.needs_local_recalibration ? `<span class="badge t2">${ICON[2]}${t("s_recal")}</span>` : `<span class="badge ok">${ICON.ok}${t("s_ok")}</span>`}</td></tr>`).join("")}</tbody></table></div>
      </section>
      <section class="card wide"><h3>${t("q_title")}</h3><p class="muted small">${t("q_sub")}</p>
        <div class="tscroll"><table><thead><tr><th>${t("q_who")}</th><th>${t("q_gaps")}</th><th class="n">${t("q_risk")}</th><th>${t("q_why")}</th><th>${t("q_how")}</th><th></th></tr></thead>
        <tbody>${q.map((r) => `<tr><td><span class="mono">${r.pseudonym}</span><br><span class="badge t${r.tier}">${ICON[r.tier]}${t(`tier.${r.tier}`)}</span></td>
          <td>${r.gaps.map((g) => esc(pkgShort(g, state.lang))).join(", ")}</td>
          <td class="n">${r.insufficient_history ? t("q_nohist") : `${num(r.predicted_noncompletion_pct)}%`}</td>
          <td class="small">${r.drivers.map((d) => esc(driverText(d.label, state.lang))).join(" · ")}</td>
          <td>${t(`channel.${r.suggested_channel}`)} · ${t(`language.${r.suggested_language}`)}${r.interpreter_needed ? `<br><span class="badge neutral">${ICON.info}${t("q_interp")}</span>` : ""}</td>
          <td><button class="btn small" data-act="openrec" data-p="${r.pseudonym}">${t("q_open")}</button></td></tr>`).join("")}</tbody></table></div>
      </section>
      <section class="card wide">${logPanel("program", (e) => e.actor === "actor_adphc", t("prog_log"))}</section>
      <section class="card wide"><h3>${t("assumptions")}</h3><ul class="assume">${D.assumptions.map((s) => `<li>${esc(s)}</li>`).join("")}${RULES.meta.assumptions.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></section>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- how it works

function howView() {
  const box = (n, title, body) => `<div class="hbox"><span class="hn">${n}</span><h3>${title}</h3><p>${body}</p></div>`;
  return `<div class="how">
    <h2>${t("h_title")}</h2><p class="muted">${t("h_sub")}</p>
    <div class="hgrid">
      ${box(1, t("h1_t"), t("h1_b"))}
      <div class="hsplit">${box(2, t("h2_t"), t("h2_b"))}${box(3, t("h3_t"), t("h3_b"))}</div>
      ${box(4, t("h4_t"), t("h4_b"))}
    </div>
    <p>${t("h_data")}</p>
    <p class="muted">${t("h_limits")}</p>
  </div>`;
}

// ---------------------------------------------------------------- modal, toast

function modal() {
  const m = state.modal;
  if (!m) return "";
  let body = "";
  if (m.type === "book") {
    const hh = household();
    const slots = [[2, "09:30"], [3, "16:00"], [6, "10:15"]].map(([d, h]) => `${addDays(REF, d)}T${h}:00Z`);
    body = `<h3 id="mt">${t("book_title", { title: esc(itemTitle(m.item, state.lang)) })}</h3>
      <p class="muted">${t("book_for", { name: esc(nm(m.item.personName)) })} · ${t("book_where", { insurance: t(`insurance.${hh.insurance}`) })}</p>
      <p><b>${t("book_pick")}</b></p>
      <div class="slots">${slots.map((s, i) => `<label class="slot"><input type="radio" name="slot" value="${s}" ${i === 0 ? "checked" : ""}><span>${fmtSlot(s)}</span></label>`).join("")}</div>
      <div class="acts end"><button class="btn" data-act="close">${t("cancel")}</button><button class="btn primary" data-act="confirm-book">${t("book_confirm")}</button></div>`;
  } else if (m.type === "snooze") {
    const canDecline = m.item.program === "IFHAS" && m.item.decision === "population";
    body = `<h3 id="mt">${t("snooze_title")}: ${esc(itemTitle(m.item, state.lang))}</h3>
      <div class="opts"><button class="btn block" data-act="confirm-snooze">${t("snooze_30")}</button>
      ${canDecline ? `<button class="btn block" data-act="confirm-decline">${t("snooze_decline")}</button><p class="muted small">${t("decline_note")}</p>` : ""}</div>
      <div class="acts end"><button class="btn" data-act="close">${t("cancel")}</button></div>`;
  } else if (m.type === "openrec") {
    body = `<h3 id="mt">${t("open_title", { p: m.p })}</h3>
      <p><b>${t("open_purpose")}</b></p>
      <div class="slots">${["purpose_outreach", "purpose_followup", "purpose_quality"].map((k, i) => `<label class="slot"><input type="radio" name="purpose" value="${k}" ${i === 0 ? "checked" : ""}><span>${t(k)}</span></label>`).join("")}</div>
      <div class="acts end"><button class="btn" data-act="close">${t("cancel")}</button><button class="btn primary" data-act="confirm-open">${t("open_confirm")}</button></div>`;
  }
  return `<div class="scrim" data-act="close"></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt">${body}</div>`;
}

// ---------------------------------------------------------------- render + events

const root = document.getElementById("app");
let tipEl;

function render() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = t("dir");
  const main = state.view === "family" ? familyView() : state.view === "program" ? programView() : howView();
  root.innerHTML = `${header()}<main>${main}</main><footer class="foot">${t("footer")}</footer>${modal()}${state.toast ? `<div class="toast" role="status">${esc(state.toast)}</div>` : ""}<div class="tip" hidden></div>`;
  tipEl = root.querySelector(".tip");
  const first = root.querySelector(".modal input, .modal button.primary");
  if (first) first.focus();
}

function toast(msg) {
  state.toast = msg;
  render();
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { state.toast = null; render(); }, 4200);
}

function findItem(id) {
  const res = evaluateHousehold(household(), RULES, REF);
  const it = res.actions.find((i) => i.id === id);
  return it;
}

root.addEventListener("click", async (ev) => {
  const el = ev.target.closest("[data-act]");
  if (!el || el.tagName === "SELECT" || el.tagName === "INPUT") return;
  const act = el.dataset.act;
  const hh = household();
  if (act === "lang") state.lang = state.lang === "en" ? "ar" : "en";
  else if (act === "view") { state.view = el.dataset.v; window.scrollTo(0, 0); }
  else if (act === "tab") state.tab = el.dataset.v;
  else if (act === "more") state.showAll = !state.showAll;
  else if (act === "why") state.open[el.dataset.id] = !state.open[el.dataset.id];
  else if (act === "member") { state.tab = "passport"; render(); document.getElementById("m-" + el.dataset.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  else if (act === "book") state.modal = { type: "book", item: findItem(el.dataset.id) };
  else if (act === "snooze") state.modal = { type: "snooze", item: findItem(el.dataset.id) };
  else if (act === "openrec") state.modal = { type: "openrec", p: el.dataset.p };
  else if (act === "close") state.modal = null;
  else if (act === "confirm-book") {
    const it = state.modal.item;
    const slot = root.querySelector('input[name="slot"]:checked').value;
    state.booked[it.id] = slot;
    state.modal = null;
    await log({ hh: hh.id, subject: it.personId, actor: `person:${manager(hh).id}`, action: "booking", purpose: "purpose_booking", data: ["demographics"], key: it.key });
    return toast(t("booked", { slot: fmtSlot(slot) }));
  } else if (act === "confirm-snooze") {
    const it = state.modal.item;
    state.snoozed[it.id] = addDays(REF, 30);
    state.modal = null;
    await log({ hh: hh.id, subject: it.personId, actor: `person:${manager(hh).id}`, action: "snoozed", purpose: "purpose_consent", data: [], key: it.key });
    return toast(t("snoozed", { date: fmtDate(state.snoozed[it.id]) }));
  } else if (act === "confirm-decline") {
    const it = state.modal.item;
    const p = hh.members.find((m) => m.id === it.personId);
    p.screening = p.screening || {};
    p.screening[it.key] = { ...(p.screening[it.key] || {}), declined_on: REF };
    state.modal = null;
    await log({ hh: hh.id, subject: it.personId, actor: `person:${it.personId}`, action: "declined", purpose: "purpose_consent", data: ["screening_history"], key: it.key });
    return toast(t("decline_note"));
  } else if (act === "confirm-open") {
    const purpose = root.querySelector('input[name="purpose"]:checked').value;
    const p = state.modal.p;
    state.modal = null;
    const i = await log({ hh: "POP", subject: p, actor: "actor_adphc", action: "pseud_open", purpose, data: ["demographics", "screening_history"] });
    return toast(t("opened", { i }));
  } else if (act === "verify") {
    const scope = el.dataset.scope;
    state.verify[scope] = { running: true };
    render();
    const filter = scope === "program" ? (e) => e.actor === "actor_adphc" : (e) => e.hh === scope;
    state.verify[scope] = await ledger.verify(filter);
  } else if (act === "tamper") {
    const scope = el.dataset.scope;
    const pool = ledger.entries.filter(scope === "program" ? (e) => e.actor === "actor_adphc" : (e) => e.hh === scope);
    const target = pool[0];
    state.tampered = { index: target.i, original: target };
    // A changed purpose: the kind of quiet edit an audit log must catch.
    ledger.entries[target.i] = { ...target, purpose: target.purpose === "purpose_quality" ? "purpose_outreach" : "purpose_quality" };
    state.verify = {};
  } else if (act === "restore") {
    ledger.entries[state.tampered.index] = state.tampered.original;
    state.tampered = null;
    state.verify = {};
  }
  render();
});

root.addEventListener("change", async (ev) => {
  const el = ev.target;
  if (el.dataset.act === "family") { state.famId = el.value; state.showAll = false; state.open = {}; state.tab = "steps"; render(); return; }
  if (el.dataset.act === "consent") {
    const hh = household();
    const p = hh.members.find((m) => m.id === el.dataset.id);
    p.consent = { ...p.consent, [el.dataset.k]: el.checked };
    await log({ hh: hh.id, subject: p.id, actor: `person:${p.id}`, action: "consent", purpose: "purpose_consent", consent: el.dataset.k, value: el.checked, data: [] });
    toast(state.lang === "ar" ? "تم تحديث الخطوات التالية وتسجيل التغيير." : "Next steps updated and the change logged.");
  }
});

root.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && state.modal) { state.modal = null; render(); }
});

root.addEventListener("pointermove", (ev) => {
  const g = ev.target.closest?.(".hov");
  if (!tipEl) return;
  if (!g) { tipEl.hidden = true; return; }
  tipEl.textContent = g.dataset.tip;
  tipEl.hidden = false;
  const x = Math.min(ev.clientX + 14, window.innerWidth - tipEl.offsetWidth - 8);
  tipEl.style.left = x + "px";
  tipEl.style.top = ev.clientY + 16 + "px";
});

seedLedger().then(render);
root.innerHTML = '<p style="padding:24px">Loading…</p>';
