// CareTrail web client. Talks to the CareTrail server (JSON API, FHIR R4,
// server-sent events). The server runs the guideline engine, the trend
// engine, the outreach model and the data-use ledger; this file renders and
// verifies.

import { STR, NAMES_AR, itemTitle, factorText, compText, reasonText, driverText, segText, pkgShort, arAge } from "./i18n.js";
import { verifyLog } from "./verify.js";

// ---------------------------------------------------------------- extra strings

Object.assign(STR.en, {
  live: "Live server · synthetic data",
  view_clinician: "Clinician",
  signed_in: "Signed in as",
  switch_role: "Switch role",
  pick_title: "Choose a demo role",
  pick_sub: "No password needed. Each role sees only what it is allowed to see; the server enforces it.",
  role_family: "Family", role_clinician: "Clinician", role_program: "Program team",
  tab_log: "Data log",
  loading: "Loading…",
  error: "Something went wrong: {msg}",
  cancel_booking: "Cancel booking",
  booked_at: "Booked: {slot} · {clinic}",
  no_slots: "No free times in the next two weeks. Try another service or ask the clinic.",
  status: { ...STR.en.status, referral_pending: "Referral made", doctor_recommended: "Recommended by your doctor" },
  decision_doctor: "Doctor's recommendation",
  trend_factor: "{lab}: {from} → {to} {unit} ({fromDate} to {toDate})",
  lab: { hba1c: "HbA1c", sbp: "Systolic blood pressure", ldl: "LDL cholesterol" },
  unit: { hba1c: "%", sbp: "mmHg", ldl: "mg/dL" },
  change_activity_drop: "Your daily steps fell from about {before} to {after} over the last month ({pct}%).",
  change_rhr_rise: "Your resting heart rate rose from about {before} to {after} beats per minute.",
  change_sleep_drop: "Your sleep fell from about {before} to {after} hours a night.",
  change_note: "Not a diagnosis. If you feel unwell, talk to your doctor.",
  log_server: "Verified in your browser against the server's signed checkpoint.",
  sig_alg: "Ed25519",
  consistency_ok: "The log only grew since you first opened it",
  // clinician
  c_title: "Clinician review",
  c_sub: "Nothing reaches a family until a clinician decides. Each decision is written to FHIR and to the data-use log.",
  c_loops: "Open follow-ups",
  c_loops_sub: "Abnormal results without a completed referral, by the deadlines in the DoH standards. {n} in the population; demo families first.",
  c_sugs: "AI suggestions to review",
  c_sugs_sub: "The trend engine proposes an earlier recheck when a person's own results are heading toward a threshold. It may only bring a check forward, never push it back. {n} pending.",
  c_refer: "Create referral",
  c_manage: "Managed in primary care",
  c_complete: "Mark visit completed",
  c_approve: "Approve",
  c_reject: "Reject",
  c_note: "Note for the record (optional)",
  c_proposed: "Proposed recheck",
  c_standard: "Standard next check",
  c_none: "None scheduled",
  c_decided: "Recent decisions",
  c_stage: { abnormal_no_referral: "No referral yet", referral_not_completed: "Referral not completed", referral_made: "Referral made, waiting for visit" },
  c_reason: { projected_cross: "Projected to cross the threshold within 12 months", rising_in_range: "Rising within the at-risk range", above_target_rising: "Above target and rising", genomic_fh_rising: "Familial hypercholesterolaemia (consented genomic result) and rising LDL", severe: "Severe range" },
  c_kind: { hba1c_recheck: "HbA1c recheck", bp_review: "Blood pressure review", lipid_review: "Cholesterol (LDL) review" },
  c_slope: "{slope} per year",
  // program
  p_live_title: "Population screening, Abu Dhabi (synthetic)",
  p_live_sub: "{people} people in {hh} households, computed live from {fhir} FHIR resources. Reference date {date}.",
  k_proactive: "At risk of lapsing",
  k_proactive_d: "Coming up, high predicted risk: contacted before the gap opens",
  m_live: "Outreach model card (live)",
  m_version: "Version {v} · trained on {n} people · {when}",
  m_retrain: "Retrain now",
  b_title: "Adaptive outreach",
  b_sub: "Thompson sampling learns which channel and message framing gets each group to book. Each week updates what it believes. The baseline is today's practice: the same SMS for everyone.",
  b_run: "Run one week of outreach",
  b_running: "Running…",
  b_week: "Week {w}: {rate}% booked vs {base}% with SMS only",
  b_none: "No outreach weeks run yet. Run a week to see the program learn.",
  b_ctx: "Group", b_best: "Best so far", b_n: "Contacts",
  b_rates: "Booking rate by week",
  arm_framing: { personal: "personal", family: "family" },
  q_rec: "Suggested invitation",
  q_proactive: "Proactive",
  reset: "Reset demo data",
  reset_confirm: "Reset all demo data to the starting point? This clears bookings, decisions and the log.",
  yes_reset: "Yes, reset",
  h4_live: "Live server: Node.js with a FHIR R4 store on SQLite. Families, clinicians and the program team sign in with separate roles; access rules, consent and small-cell suppression are enforced on the server.",
  fhir_link: "FHIR R4 endpoint",
  fresh: "Start fresh",
  fresh_d: "Reviewers share one demo. This puts the three demo families back to their starting state (it also happens after 20 quiet minutes).",
  fresh_done: "Demo families reset. You start from a clean state.",
  sim_today: "Today in the simulation",
  export: "Download our record (FHIR R4)",
  export_d: "Your household's record as a standard FHIR R4 Bundle, the format hospitals and Malaffi use. Data you have not shared is left out.",
  install: "Install app",
  pilot_login: "In a pilot, people sign in with UAE PASS and CareTrail runs as a module inside Sahatna.",
});
Object.assign(STR.ar, {
  live: "خادم مباشر · بيانات اصطناعية",
  view_clinician: "الطبيب",
  signed_in: "مسجّل باسم",
  switch_role: "تبديل الدور",
  pick_title: "اختر دورًا تجريبيًا",
  pick_sub: "لا حاجة لكلمة مرور. كل دور يرى ما يُسمح له فقط، والخادم يفرض ذلك.",
  role_family: "العائلة", role_clinician: "الطبيب", role_program: "فريق البرنامج",
  tab_log: "سجل البيانات",
  loading: "جارٍ التحميل…",
  error: "حدث خطأ: {msg}",
  cancel_booking: "إلغاء الحجز",
  booked_at: "محجوز: {slot} · {clinic}",
  no_slots: "لا توجد مواعيد متاحة خلال أسبوعين. جرّب خدمة أخرى أو اتصل بالعيادة.",
  status: { ...STR.ar.status, referral_pending: "تم التحويل", doctor_recommended: "بتوصية من طبيبك" },
  decision_doctor: "توصية الطبيب",
  trend_factor: "{lab}: {from} ← {to} {unit} ({fromDate} إلى {toDate})",
  lab: { hba1c: "السكر التراكمي", sbp: "ضغط الدم الانقباضي", ldl: "الكوليسترول الضار" },
  unit: { hba1c: "%", sbp: "ملم زئبق", ldl: "ملغ/دل" },
  change_activity_drop: "انخفضت خطواتك اليومية من نحو {before} إلى {after} خلال الشهر الأخير ({pct}%).",
  change_rhr_rise: "ارتفع نبض الراحة من نحو {before} إلى {after} نبضة في الدقيقة.",
  change_sleep_drop: "انخفض نومك من نحو {before} إلى {after} ساعات في الليلة.",
  change_note: "هذا ليس تشخيصًا. إن شعرت بتوعك فتحدث إلى طبيبك.",
  log_server: "تم التحقق في متصفحك مقابل نقطة التحقق الموقّعة من الخادم.",
  consistency_ok: "السجل لم يتغير إلا بالإضافة منذ فتحته أول مرة",
  c_title: "مراجعة الطبيب",
  p_live_title: "الفحص السكاني في أبوظبي (بيانات اصطناعية)",
  b_title: "التواصل التكيفي",
  reset: "إعادة ضبط البيانات التجريبية",
  fresh: "ابدأ من جديد",
  fresh_d: "يتشارك المراجعون عرضًا واحدًا. هذا يعيد العائلات التجريبية الثلاث إلى حالتها الأولى (ويحدث تلقائيًا بعد 20 دقيقة من الهدوء).",
  fresh_done: "تمت إعادة العائلات التجريبية. تبدأ من حالة نظيفة.",
  sim_today: "اليوم في المحاكاة",
  export: "تنزيل سجلنا (FHIR R4)",
  export_d: "سجل أسرتك بصيغة FHIR R4 القياسية التي تستخدمها المستشفيات وملفّي. البيانات التي لم تشاركها لا تُضمَّن.",
  install: "تثبيت التطبيق",
  pilot_login: "في التجربة الفعلية يسجّل الناس الدخول عبر الهوية الرقمية UAE PASS ويعمل كير ترِيل كوحدة داخل تطبيق صحتنا.",
});

// ---------------------------------------------------------------- state

const qs = new URLSearchParams(location.search);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const state = {
  lang: qs.get("lang") === "ar" || store.get("ct_lang") === "ar" ? "ar" : "en",
  token: store.get("ct_token"),
  user: null,
  meta: null,
  view: "home",
  tab: "steps",
  family: null,
  clinician: null,
  program: null,
  queue: null,
  bandit: null,
  ledger: {},
  firstCheckpoint: {},
  verify: {},
  tampered: null,
  open: {},
  showAll: false,
  modal: null,
  toast: null,
  busy: false,
  error: null,
  qOffset: 0,
};

const t = (key, vars = {}) => {
  let s = key.split(".").reduce((o, k) => (o == null ? o : o[k]), STR[state.lang]);
  if (s == null) s = key.split(".").reduce((o, k) => (o == null ? o : o[k]), STR.en) ?? key;
  return String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nm = (s) => (state.lang === "ar" ? NAMES_AR[s] || s : s);
const loc = () => (state.lang === "ar" ? "ar-AE-u-nu-latn" : "en-GB");
const num = (n) => (n == null ? "–" : new Intl.NumberFormat(loc()).format(n));
const fmtDate = (s) => (s ? new Intl.DateTimeFormat(loc(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(s.length === 10 ? s + "T00:00:00Z" : s)) : "");
const fmtSlot = (s) => new Intl.DateTimeFormat(loc(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }).format(new Date(s));
const REF = () => state.meta?.ref || "2026-11-15";

async function api(path, { method = "GET", body } = {}) {
  const r = await fetch(path, { method, headers: { "content-type": "application/json", ...(state.token ? { authorization: `Bearer ${state.token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { signOut(); throw new Error(data.error || "Please sign in"); }
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}

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
  doc: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 14c.6-3 2.6-4.4 5-4.4s4.4 1.4 5 4.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8 10.5v2.4M6.8 11.7h2.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
};
const statusClass = (it) => (it.status === "doctor_recommended" ? "doc" : it.tier ? `t${it.tier}` : it.status === "up_to_date" ? "ok" : "neutral");
const statusIcon = (it) => (it.status === "doctor_recommended" ? ICON.doc : it.tier ? ICON[it.tier] : it.status === "up_to_date" ? ICON.ok : it.status === "declined" ? ICON.pause : it.status === "not_eligible" ? ICON.lock : ICON.info);
const statusLabel = (it) => (["doctor_recommended", "referral_pending"].includes(it.status) ? t(`status.${it.status}`) : it.tier && it.tier <= 4 ? t(`tier.${it.tier}`) : t(`status.${it.status}`));

// ---------------------------------------------------------------- data loading

async function boot() {
  try {
    state.meta = await api("/api/meta");
    const as = qs.get("as");
    if (as && state.meta.personas.some((p) => p.id === as)) await signIn(as, { quiet: true });
    else if (state.token) {
      try { const claims = JSON.parse(atob(state.token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"))); state.user = state.meta.personas.find((p) => p.id === claims.id); } catch { state.token = null; }
    }
    if (state.user) { state.view = defaultView(); await load(); }
    connectEvents();
  } catch (e) { state.error = e.message; }
  render();
}
const defaultView = () => (qs.get("view") && ["family", "clinician", "program", "how"].includes(qs.get("view")) ? qs.get("view") : state.user.role);

async function signIn(persona, { quiet } = {}) {
  const { token, user } = await api("/api/login", { method: "POST", body: { persona } });
  state.token = token; state.user = user;
  store.set("ct_token", token);
  state.view = user.role; state.tab = "steps"; state.open = {}; state.showAll = false;
  state.ledger = {}; state.verify = {}; state.tampered = null;
  if (!quiet) { await load(); connectEvents(); render(); }
}
function signOut() {
  state.token = null; state.user = null; store.set("ct_token", null); state.view = "home";
}

async function load() {
  const role = state.user?.role;
  if (role === "family") state.family = await api("/api/family");
  if (role === "clinician") state.clinician = await api("/api/clinician/queue");
  if (role === "program") {
    [state.program, state.queue, state.bandit] = await Promise.all([api("/api/program/overview"), api(`/api/program/queue?offset=${state.qOffset}`), api("/api/program/bandit")]);
  }
  if (state.tab === "log" || role === "program") await loadLedger();
}

async function loadLedger() {
  const scope = state.user.role === "family" ? state.user.hh : state.user.role;
  const first = state.firstCheckpoint[scope];
  const data = await api(`/api/ledger${first ? `?from=${first.size}` : ""}`);
  if (!first) state.firstCheckpoint[scope] = { size: data.checkpoint.size, root: data.checkpoint.root };
  state.ledger[scope] = data;
  state.tampered = null;
}

let es;
function connectEvents() {
  if (es) es.close();
  if (!state.token) return;
  try {
    es = new EventSource(`/api/events?token=${encodeURIComponent(state.token)}`);
    let timer;
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data);
      if (ev.type === "reset") { state.firstCheckpoint = {}; }
      clearTimeout(timer);
      timer = setTimeout(async () => { try { delete state.verify[scopeKey()]; await load(); render(); } catch { /* ignore */ } }, 250);
    };
  } catch { /* SSE unavailable */ }
}
const scopeKey = () => (state.user?.role === "family" ? state.user.hh : state.user?.role);

// ---------------------------------------------------------------- common views

function header() {
  const v = (id, label) => `<button class="seg ${state.view === id ? "on" : ""}" data-act="view" data-v="${id}" aria-pressed="${state.view === id}">${label}</button>`;
  const role = state.user?.role;
  const views = role ? [v(role, t(role === "family" ? "view_family" : role === "clinician" ? "view_clinician" : "view_program")), v("how", t("view_how"))] : [v("home", t("pick_title")), v("how", t("view_how"))];
  return `<header class="top">
    <div class="brand">
      <svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M7 30c6-1 7-9 13-10s8-9 13-10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="1 5.2"/><circle cx="7" cy="30" r="4" fill="currentColor"/><circle cx="20" cy="20" r="4" fill="currentColor"/><circle cx="33" cy="10" r="5.4" fill="var(--accent)"/><path d="m30.8 10 1.6 1.6 3-3.2" fill="none" stroke="var(--surface)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div><div class="name">CareTrail</div><div class="tag">${t("app_tag")}</div></div>
    </div>
    <nav class="views" aria-label="View">${views.join("")}</nav>
    <div class="right">
      <span class="badge-syn">${t("live")}</span>
      ${state.user ? `<label class="who-pick"><span class="vh">${t("switch_role")}</span><select id="role-switch" data-act="switch" aria-label="${t("switch_role")}">${state.meta.personas.map((p) => `<option value="${p.id}" ${p.id === state.user.id ? "selected" : ""}>${esc(nm(p.name))} · ${t(`role_${p.role}`)}</option>`).join("")}</select></label>` : ""}
      ${installEvt ? `<button class="lang" data-act="install">${t("install")}</button>` : ""}
      <button class="lang" data-act="lang" lang="${state.lang === "ar" ? "en" : "ar"}">${t("lang_switch")}</button>
    </div>
  </header>`;
}

function picker() {
  const groups = ["family", "clinician", "program"];
  return `<section class="picker">
    <h1>${t("pick_title")}</h1><p class="muted">${t("pick_sub")}</p>
    <div class="pick-grid">${groups.map((g) => `<div class="pick-col"><h2>${t(`role_${g}`)}</h2>${state.meta.personas.filter((p) => p.role === g).map((p) => `<button class="pick" data-act="signin" data-p="${p.id}"><b>${esc(nm(p.name))}</b><span>${esc(p.label)}</span></button>`).join("")}</div>`).join("")}</div>
    <div class="fresh"><button class="btn" data-act="fresh">${t("fresh")}</button><span class="muted small">${t("fresh_d")}</span></div>
    <p class="muted small">${t("h4_live")} ${t("pilot_login")} <a href="/fhir/metadata" target="_blank" rel="noopener">${t("fhir_link")}</a></p>
    <p class="muted small">${t("sim_today")}: ${fmtDate(REF())}</p>
  </section>`;
}

// ---------------------------------------------------------------- family

const personOf = (id) => state.family.members.find((m) => m.id === id);
function ageLabel(p) {
  const days = (new Date(REF()) - new Date(p.birth_date)) / 864e5;
  if (days < 730) { const m = Math.max(1, Math.floor(days / 30.44)); return state.lang === "ar" ? arAge(m) : t("age_m", { n: m }); }
  return t("age_y", { n: Math.floor(days / 365.25) });
}
const roleOf = (p) => (p.kind === "child" ? (p.sex === "female" ? "daughter" : "son") : p.role);

function factorLine(f) {
  if (f.code?.startsWith("trend_")) {
    return t("trend_factor", { lab: t(`lab.${f.lab}`), from: num(f.from), to: num(f.to), unit: t(`unit.${f.lab}`), fromDate: fmtDate(f.from_date), toDate: fmtDate(f.to_date) });
  }
  return factorText(f, state.lang);
}

function reasonLine(r) {
  if (r.code === "doctor_recommended") return state.lang === "ar" ? `أوصى به ${esc(r.by)} في ${fmtDate(r.date)}. الموعد المقترح قبل ${fmtDate(r.due)}.` : `Recommended by ${esc(r.by)} on ${fmtDate(r.date)}. Suggested before ${fmtDate(r.due)}.`;
  if (r.code === "referral_made") return state.lang === "ar" ? `تم التحويل إلى ${esc(r.specialist)} في ${fmtDate(r.date)}${r.by ? ` بواسطة ${esc(r.by)}` : ""}. احجز الزيارة.` : `Referred to ${esc(r.specialist)} on ${fmtDate(r.date)}${r.by ? ` by ${esc(r.by)}` : ""}. Book the visit.`;
  return esc(reasonText(r, state.lang, fmtDate));
}

function whyPanel(it) {
  const f = it.factors || [];
  const comps = it.components?.length ? `<div class="why-block"><h4>${t("components_at_visit")}</h4><ul class="comps">${it.components.map((c) => `<li>${esc(compText(c, state.lang))}</li>`).join("")}</ul></div>` : "";
  return `<div class="why" id="why-${esc(it.id)}">
    <div class="why-block"><h4>${t("factors")}</h4>${f.length ? `<ul class="factors">${f.map((x) => `<li><span class="cat">${t(`cat.${x.category}`)}</span>${esc(factorLine(x))}</li>`).join("")}</ul>` : `<p class="muted">${t("no_factors")}</p>`}</div>
    ${comps}
    <div class="why-block"><h4>${t("data_used")}</h4><div class="chips">${(it.dataUsed || []).map((c) => `<span class="chip">${t(`cat.${c}`)}</span>`).join("")}</div></div>
    <div class="why-block"><h4>${t("source")}</h4><p class="src">${esc(it.source)}${it.program === "WCV" ? " · DoH Well-Child Visit Standard V10 (Dec 2025)" : it.program === "IFHAS" ? " · DoH IFHAS Standard V10 (Jul 2025)" : ""}</p></div>
    ${it.decision === "clinical" ? `<p class="clin">${ICON.info}<span>${t("clinical_note")}</span></p>` : ""}
  </div>`;
}

function stepCard(it) {
  const open = !!state.open[it.id];
  const p = personOf(it.personId);
  const title = it.status === "doctor_recommended" ? (state.lang === "ar" ? { hba1c_recheck: "إعادة فحص السكر التراكمي", bp_review: "مراجعة ضغط الدم", lipid_review: "مراجعة الكوليسترول الضار" }[it.key] || it.title : it.title) : itemTitle(it, state.lang);
  return `<article class="step ${statusClass(it)}">
    <div class="step-head"><span class="badge ${statusClass(it)}">${statusIcon(it)}${statusLabel(it)}</span><span class="who">${esc(nm(p?.name))}</span></div>
    <h3>${esc(title)}</h3>
    <p class="reason">${(it.reasons || []).map(reasonLine).join(" ")}</p>
    <div class="chips"><span class="chip ${it.decision === "clinical" ? "clinical" : ""}">${it.status === "doctor_recommended" ? t("decision_doctor") : t(`decision_${it.decision}`)}</span></div>
    ${it.booked ? `<p class="booked">${ICON.ok}<span>${t("booked_at", { slot: fmtSlot(it.booked.start), clinic: esc(it.booked.location) })}</span></p>` : ""}
    <div class="acts">
      ${it.booked ? `<button class="btn" data-act="cancel" data-id="${esc(it.booked.id)}">${t("cancel_booking")}</button>` : `<button class="btn primary" data-act="book" data-id="${esc(it.id)}">${t("book")}</button><button class="btn" data-act="snooze" data-id="${esc(it.id)}">${t("not_now")}</button>`}
      <button class="btn link" data-act="why" data-id="${esc(it.id)}" aria-expanded="${open}" aria-controls="why-${esc(it.id)}">${open ? t("hide_why") : t("why")}</button>
    </div>
    ${open ? whyPanel(it) : ""}
  </article>`;
}

function stamps(f) {
  return `<div class="stamps" role="list">${f.members.map((p) => {
    const tiers = p.items.filter((i) => i.tier && i.tier <= 4 && !i.snoozedUntil).map((i) => i.tier);
    const best = tiers.length ? Math.min(...tiers) : null;
    const notCov = !p.private && !best && p.items.length && p.items.every((i) => i.status === "not_eligible");
    const cls = p.private || notCov ? "neutral" : best ? `t${best}` : "ok";
    const label = p.private ? t("status.info") : notCov ? t("status.not_eligible") : best ? t(`tier.${best}`) : t("up_to_date");
    return `<button class="stamp ${cls}" role="listitem" data-act="member" data-id="${p.id}" aria-label="${esc(nm(p.name))}: ${esc(label)}">
      <span class="ring"><span class="init">${esc(nm(p.name)).slice(0, 1)}</span><span class="dot">${p.private ? ICON.lock : notCov ? ICON.info : best ? ICON[best] : ICON.ok}</span></span>
      <span class="sn">${esc(nm(p.name))}</span><span class="sr">${t(`role.${roleOf(p)}`)} · ${ageLabel(p)}</span>
    </button>`;
  }).join("")}</div>`;
}

function familySteps(f) {
  const mgr = personOf(f.manager);
  const visible = f.actions;
  const shown = state.showAll ? visible : visible.slice(0, 3);
  const extra = visible.length - 3;
  const notes = [];
  if (f.household.insurance !== "Thiqa") notes.push(`<aside class="note">${ICON.info}<div><strong>${t("not_covered_title")}</strong><p>${t("not_covered_body")}</p></div></aside>`);
  if (!["ar", "en"].includes(f.household.preferred_language)) notes.push(`<aside class="note">${ICON.info}<div><p>${t("lang_note_ur")}</p></div></aside>`);
  f.members.filter((m) => m.private).forEach((m) => notes.push(`<aside class="note">${ICON.lock}<div><strong>${t("private_member", { name: esc(nm(m.name)) })}</strong><p>${t("private_body", { name: esc(nm(m.name)) })}</p></div></aside>`));
  const well = f.members.filter((p) => p.wearable).map((p) => `<section class="well">
      <h3>${t("wellbeing_title")} · ${esc(nm(p.name))}</h3>
      <div class="well-stats"><div><b>${num(p.wearable.steps_per_day)}</b><span>${state.lang === "ar" ? "خطوة يوميًا" : "steps a day"}</span></div><div><b>${num(p.wearable.sleep_hours)}</b><span>${state.lang === "ar" ? "ساعات نوم" : "h sleep"}</span></div><div><b>${num(p.wearable.resting_hr)}</b><span>${state.lang === "ar" ? "نبض الراحة" : "resting HR"}</span></div></div>
      ${(p.change || []).map((c) => `<p class="change">${ICON.info}<span>${t(`change_${c.kind}`, { before: num(c.before), after: num(c.after), pct: num(c.pct) })}</span></p>`).join("")}
      ${p.change ? `<p class="muted small">${t("change_note")}</p>` : ""}
      <p>${t("wellbeing_tip")}</p><p class="muted small">${t("wellbeing_shared")}</p>
    </section>`).join("");
  return `
    <p class="hello">${t("hello", { name: esc(nm(mgr.name)) })}</p>
    <p class="muted">${t("you_manage", { n: num(f.members.length) })}</p>
    ${stamps(f)}
    <h2 class="steps-title">${visible.length ? t("steps_title_n", { n: num(Math.min(3, visible.length)) }) : t("steps_title_0")}</h2>
    <p class="muted small">${t("steps_sub")}</p>
    <div class="steps">${shown.map(stepCard).join("")}</div>
    ${extra > 0 ? `<button class="btn more" data-act="more">${state.showAll ? t("fewer_steps") : t("more_steps", { n: num(extra) })}</button>` : ""}
    ${notes.join("")}${well}`;
}

function visitTrail(p) {
  const sched = [1, 2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60, 72];
  const m = (new Date(REF()) - new Date(p.birth_date)) / 864e5 / 30.44;
  const attended = new Set(p.wcv?.attended_months || []);
  const current = Math.max(...sched.filter((x) => x <= m));
  return `<div class="trail"><h4>${t("visit_trail")}</h4><ol>${sched.map((x) => {
    const st = attended.has(x) ? "att" : x < current ? "miss" : x === current ? "now" : "fut";
    const lab = x < 24 || x % 12 ? t("months_short", { n: x }) : t("years_short", { n: x / 12 });
    return `<li class="${st}" title="${esc(lab)}"><span class="pip"></span><span class="lab">${lab}</span></li>`;
  }).join("")}</ol><div class="legend"><span class="att">${t("attended")}</span><span class="miss">${t("missed")}</span><span class="now">${t("due_now")}</span><span class="fut">${t("upcoming")}</span></div></div>`;
}

function passport(f) {
  return `<h2>${t("passport_title")}</h2>${f.members.map((p) => {
    const head = `<header><span class="avatar">${esc(nm(p.name)).slice(0, 1)}</span><div><h3>${esc(nm(p.name))}</h3><p class="muted small">${t(`role.${roleOf(p)}`)} · ${ageLabel(p)} · ${t(`insurance.${f.household.insurance}`)}</p></div></header>`;
    if (p.private) return `<section class="member" id="m-${p.id}">${head}<p class="muted">${ICON.lock} ${t("private_body", { name: esc(nm(p.name)) })}</p></section>`;
    const groups = [
      [t("needs_action"), p.items.filter((i) => i.tier && i.tier <= 4)],
      [t("tier.5"), p.items.filter((i) => i.tier === 5)],
      [t("up_to_date"), p.items.filter((i) => i.status === "up_to_date")],
      [t("other"), p.items.filter((i) => !i.tier && i.status !== "up_to_date")],
    ].filter(([, l]) => l.length);
    const row = (i) => `<li class="prow"><span class="badge ${statusClass(i)}">${statusIcon(i)}${statusLabel(i)}</span><div><b>${esc(i.status === "doctor_recommended" ? i.title : itemTitle(i, state.lang))}</b><span class="muted small">${(i.reasons || []).map(reasonLine).join(" ")}${i.snoozedUntil ? " · " + t("snoozed", { date: fmtDate(i.snoozedUntil) }) : ""}${i.booked ? " · " + t("booked_at", { slot: fmtSlot(i.booked.start), clinic: esc(i.booked.location) }) : ""}</span></div></li>`;
    return `<section class="member" id="m-${p.id}">${head}${p.kind === "child" ? visitTrail(p) : ""}
      ${groups.length ? groups.map(([g, l]) => `<h4 class="grp">${g}</h4><ul class="plist">${l.map(row).join("")}</ul>`).join("") : `<p class="muted">${t("no_items")}</p>`}</section>`;
  }).join("")}`;
}

function toggle(p, key, disabled = false) {
  const on = key === "program_screening" ? true : !!p.consent?.[key];
  const k = key === "share_with_household" ? "share" : key;
  return `<label class="tog ${disabled ? "dis" : ""}"><span class="tl"><b>${t(`c_${k}`)}</b><span class="muted small">${t(`c_${k}_d`)}</span></span>
    <input id="consent-${p.id}-${key}" type="checkbox" role="switch" ${on ? "checked" : ""} ${disabled ? "disabled" : ""} data-act="consent" data-id="${p.id}" data-k="${key}"><span class="sw" aria-hidden="true"></span></label>`;
}

function privacy(f) {
  return `<h2>${t("privacy_title")}</h2><p class="muted">${t("privacy_sub")}</p>
    ${f.members.map((p) => `<section class="member consent"><header><span class="avatar">${esc(nm(p.name)).slice(0, 1)}</span><div><h3>${esc(nm(p.name))}</h3><p class="muted small">${t(`role.${roleOf(p)}`)} · ${ageLabel(p)}</p></div></header>
      ${toggle(p, "program_screening", true)}
      ${p.kind === "adult" ? toggle(p, "genomic") + toggle(p, "wearables") + (p.id !== f.manager ? toggle(p, "share_with_household") : "") : `<p class="muted small">${t("child_always")}</p>`}
    </section>`).join("")}
    <section class="member"><h3>${t("export")}</h3><p class="muted small">${t("export_d")}</p><div class="acts"><button class="btn" data-act="export">${t("export")}</button></div></section>`;
}

// ---------------------------------------------------------------- ledger view

const ACT = {
  en: {
    result_received: "Result received", referral_created: "Referral created", referral_completed: "Referral visit completed", loop_managed: "Follow-up managed in primary care",
    program_view: "Viewed screening status", program_open: "Opened record for outreach", declined: "Postponed {what}", consent: "Consent changed: {what} {state}",
    booking: "Booking: {what}", booking_cancelled: "Booking cancelled: {what}", snoozed: "Reminder snoozed: {what}",
    suggestion_approved: "Clinician approved: {what}", suggestion_rejected: "Clinician rejected: {what}", outreach_week: "Outreach week run",
    demo_reset: "Demo families reset", export: "Record downloaded (FHIR Bundle)", actor_system: "CareTrail system", purpose_demo: "Fresh start for the next reviewer",
    actor_lab: "Network laboratory (simulated)", actor_adphc: "ADPHC screening team", actor_clinic: "Primary care clinic", actor_clinician: "Clinician",
    purpose_result: "Deliver result to the record", purpose_referral: "Refer for follow-up", purpose_program: "Close an open follow-up", purpose_consent: "Person's own choice",
    purpose_booking: "Book a screening", purpose_review: "Clinical review of a trend suggestion",
  },
  ar: {
    result_received: "استلام نتيجة", referral_created: "إنشاء تحويل", referral_completed: "اكتمال زيارة التحويل", loop_managed: "متابعة في الرعاية الأولية",
    program_view: "الاطلاع على حالة الفحص", program_open: "فتح السجل للتواصل", declined: "تأجيل {what}", consent: "تغيير الموافقة: {what} {state}",
    booking: "حجز: {what}", booking_cancelled: "إلغاء حجز: {what}", snoozed: "تأجيل التذكير: {what}",
    suggestion_approved: "وافق الطبيب: {what}", suggestion_rejected: "رفض الطبيب: {what}", outreach_week: "أسبوع تواصل",
    demo_reset: "إعادة ضبط العائلات التجريبية", export: "تنزيل السجل (FHIR)", actor_system: "نظام كير ترِيل", purpose_demo: "بداية نظيفة للمراجع التالي",
    actor_lab: "مختبر الشبكة (محاكاة)", actor_adphc: "فريق الفحص في مركز أبوظبي للصحة العامة", actor_clinic: "عيادة الرعاية الأولية", actor_clinician: "الطبيب",
    purpose_result: "إضافة النتيجة إلى السجل", purpose_referral: "التحويل للمتابعة", purpose_program: "إغلاق متابعة مفتوحة", purpose_consent: "اختيار الشخص نفسه",
    purpose_booking: "حجز فحص", purpose_review: "مراجعة سريرية لاقتراح مبني على الاتجاه",
  },
};
const a = (k, v = {}) => (ACT[state.lang][k] || ACT.en[k] || STR[state.lang][k] || STR.en[k] || k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "");
function entryText(e) {
  const kindNames = t("c_kind");
  const what = e.key ? (kindNames[e.key] || pkgShort(e.key, state.lang)) : "";
  const consentName = { genomic: t("c_genomic"), wearables: t("c_wearables"), share_with_household: t("c_share") }[e.consent] || "";
  const action = a(e.action, { what, state: e.value ? t("on") : t("off") });
  const actor = e.actor.startsWith("person:") ? (state.family ? nm(personOf(e.actor.slice(7))?.name || e.actor.slice(7)) : e.actor.slice(7)) : e.actorName ? `${a(e.actor)} (${e.actorName})` : a(e.actor);
  const subj = e.subject && state.family ? nm(personOf(e.subject)?.name || "") : e.pseudonym || "";
  return { action: e.action === "consent" ? a("consent", { what: consentName, state: e.value ? t("on") : t("off") }) : action, actor, purpose: a(e.purpose), subj, detail: e.detail };
}

function logPanel(scope, title) {
  const data = state.ledger[scope];
  if (!data) return `<section class="log"><h3>${title}</h3><p class="muted">${t("loading")}</p></section>`;
  const v = state.verify[scope];
  const cp = data.checkpoint;
  const banner = v ? (v.running ? `<p class="vres">${t("verifying")}</p>` : v.ok ? `<p class="vres ok">${ICON.shield}<span>${t("verified_ok", { n: num(v.checked) })} ${v.signature === null ? `(${t("log_sig")}: ${t("sig_unavailable")})` : ""}</span></p>` : `<p class="vres bad">${ICON[1]}<span>${t("verified_bad", { i: v.badIndex ?? "?" })}</span></p>`) : "";
  const entries = data.entries.slice().reverse();
  return `<section class="log">
    <h3>${title}</h3><p class="muted small">${t("log_sub")} ${t("log_server")}</p>
    <dl class="cp"><div><dt>${t("log_size")}</dt><dd>${num(cp.size)}</dd></div><div><dt>${t("log_root")}</dt><dd class="mono">${cp.root.slice(0, 16)}…</dd></div><div><dt>${t("log_sig")}</dt><dd class="mono">${cp.alg} · ${cp.signature.slice(0, 12)}…</dd></div></dl>
    <div class="acts"><button class="btn primary" data-act="verify" data-scope="${scope}">${t("verify")}</button>
    ${state.tampered ? `<button class="btn" data-act="restore" data-scope="${scope}">${t("restore")}</button>` : `<button class="btn" data-act="tamper" data-scope="${scope}">${t("tamper")}</button>`}</div>
    ${state.tampered ? `<p class="muted small">${t("tampered", { i: state.tampered.index })}</p>` : ""}
    ${banner}
    <ol class="entries">${entries.slice(0, 30).map(({ entry: e, leaf }) => {
      const x = entryText(e);
      return `<li class="${state.tampered?.index === e.i ? "edited" : ""}"><div class="eh"><span class="mono">#${e.i}</span><span>${fmtDate(e.ts)}</span><span class="mono muted">${t("leaf")} ${leaf.slice(0, 10)}</span></div>
        <b>${esc(x.action)}${x.subj ? " · " + esc(x.subj) : ""}</b><span class="small">${t("actor")}: ${esc(x.actor)}</span><span class="small">${t("purpose")}: ${esc(x.purpose)}</span>
        ${e.data?.length ? `<span class="small">${t("data")}: ${e.data.map((c) => t(`cat.${c}`)).join(", ")}</span>` : ""}${x.detail ? `<span class="small muted">${esc(x.detail.includes("T") && x.detail.length > 18 ? fmtSlot(x.detail) : x.detail)}</span>` : ""}</li>`;
    }).join("")}</ol>
  </section>`;
}

function tryPanel() {
  const steps = state.lang === "ar"
    ? ["افتح «لماذا؟» على متابعة خالد: السبب والمصدر ومن يقرر.", "احجز موعدًا: يُنشأ موعد FHIR حقيقي وتراه لوحة البرنامج فورًا.", "بدّل الدور إلى الطبيب ووافق على اقتراح الكوليسترول لخالد، ثم عد إلى مريم.", "في «سجل البيانات» تحقق من السجل ثم حاكِ التلاعب.", "بدّل إلى فريق البرنامج وشغّل أسبوع تواصل."]
    : ["Open “Why this?” on Khalid's open follow-up: reason, source, who decides.", "Book a time: a real FHIR Appointment is created and the program view sees it at once.", "Switch role to the clinician, approve Khalid's cholesterol suggestion, then switch back to Mariam.", "In Data log, verify the log, then simulate tampering.", "Switch to the program team and run a week of adaptive outreach."];
  return `<aside class="try"><h3>${state.lang === "ar" ? "جرّبه في دقيقتين" : "Try it in two minutes"}</h3><ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol>
  <div class="fresh"><button class="btn small" data-act="fresh">${t("fresh")}</button></div>
  <p class="muted small">${t("sim_today")}: ${fmtDate(REF())} · <a href="/fhir/metadata" target="_blank" rel="noopener">${t("fhir_link")}</a></p></aside>`;
}

function familyView() {
  const f = state.family;
  if (!f) return `<p>${t("loading")}</p>`;
  const tab = (id, label) => `<button role="tab" class="tab ${state.tab === id ? "on" : ""}" aria-selected="${state.tab === id}" data-act="tab" data-v="${id}">${label}</button>`;
  const body = state.tab === "steps" ? familySteps(f) : state.tab === "passport" ? passport(f) : state.tab === "privacy" ? privacy(f) : logPanel(state.user.hh, t("log_title"));
  return `<div class="family-wrap"><div class="phone">
      <div class="fam-bar"><p class="fam-name"><b>${esc(nm(f.household.label))}</b> · ${t(`insurance.${f.household.insurance}`)} · ${t(`region.${f.household.region}`)}</p></div>
      <div class="tabs" role="tablist">${tab("steps", t("tab_steps"))}${tab("passport", t("tab_passport"))}${tab("privacy", t("tab_privacy"))}${tab("log", t("tab_log"))}</div>
      <div class="screen">${body}</div></div>${tryPanel()}</div>`;
}

// ---------------------------------------------------------------- clinician

function spark(series, lab) {
  const W = 220, H = 70, p = 8;
  const vals = series.map((s) => s.value);
  const thr = { hba1c: 6.5, sbp: 140, ldl: 190 }[lab];
  const lo = Math.min(...vals, thr) * 0.97, hi = Math.max(...vals, thr) * 1.02;
  const x = (i) => p + (i * (W - 2 * p)) / Math.max(1, series.length - 1);
  const y = (v) => H - p - ((v - lo) / (hi - lo)) * (H - 2 * p);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t(`lab.${lab}`))}">
    <line x1="${p}" x2="${W - p}" y1="${y(thr)}" y2="${y(thr)}" class="thr"/><text x="${W - p}" y="${y(thr) - 3}" class="axis" text-anchor="end">${thr}</text>
    <polyline points="${series.map((s, i) => `${x(i)},${y(s.value)}`).join(" ")}" class="line"/>
    ${series.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.value)}" r="3.5" class="pt hov" data-tip="${esc(fmtDate(s.date))}: ${s.value}"/>`).join("")}
    <text x="${x(series.length - 1)}" y="${y(vals[vals.length - 1]) - 7}" class="val" text-anchor="end">${vals[vals.length - 1]}</text>
  </svg>`;
}

function clinicianView() {
  const c = state.clinician;
  if (!c) return `<p>${t("loading")}</p>`;
  const nameOf = (r) => (r.name ? esc(nm(r.name)) : `<span class="mono">${esc(r.patient || r.personId)}</span>`);
  const loopRow = (r) => `<tr>
    <td>${nameOf(r)}<br><span class="muted small">${r.sex === "female" ? "F" : "M"} · ${r.age} y</span></td>
    <td><b>${esc(r.title)}</b><br><span class="muted small">${esc(r.source)}</span></td>
    <td><span class="badge ${r.stage === "referral_made" ? "t2" : "t1"}">${r.stage === "referral_made" ? ICON[2] : ICON[1]}${t(`c_stage.${r.stage}`)}</span><br><span class="muted small">${fmtDate(r.date)}${r.limit ? ` · ${esc(r.limit)}` : ""}</span></td>
    <td class="small">${esc(r.specialist || "")}</td>
    <td class="acts-cell">${r.stage === "abnormal_no_referral"
      ? `<button class="btn small primary" data-act="refer" data-p="${r.patient}" data-k="${esc(r.key)}" data-s="${esc(r.specialist || "")}">${t("c_refer")}</button><button class="btn small" data-act="manage" data-p="${r.patient}" data-k="${esc(r.key)}">${t("c_manage")}</button>`
      : `<button class="btn small" data-act="complete" data-p="${r.patient}" data-k="${esc(r.key)}">${t("c_complete")}</button>`}</td></tr>`;
  const sugCard = (s) => `<article class="sug">
    <header><div><b>${nameOf(s)}</b> <span class="muted small">${s.sex === "female" ? "F" : "M"} · ${s.age} y${s.conditions?.length ? " · " + s.conditions.map((c) => c.replace(/_/g, " ")).join(", ") : ""}${s.genomic?.length ? " · " + esc(s.genomic.join(", ")) : ""}</span></div><span class="badge t2">${ICON[2]}${esc(t(`c_kind.${s.kind}`))}</span></header>
    <div class="sug-body">${spark(s.series, s.lab)}
      <dl class="mc"><div><dt>${t(`lab.${s.lab}`)}</dt><dd>${s.trend.last} ${t(`unit.${s.lab}`)} · ${t("c_slope", { slope: (s.trend.slope_per_year > 0 ? "+" : "") + num(Math.round(s.trend.slope_per_year * 10) / 10) })}</dd></div>
      <div><dt>${state.lang === "ar" ? "السبب" : "Why"}</dt><dd>${esc(t(`c_reason.${s.reason}`))}</dd></div>
      <div><dt>${t("c_proposed")}</dt><dd><b>${fmtDate(s.proposed_date)}</b></dd></div>
      <div><dt>${t("c_standard")}</dt><dd>${s.standard_next_due ? fmtDate(s.standard_next_due) : t("c_none")}</dd></div></dl></div>
    <label class="note-in"><span class="small muted">${t("c_note")}</span><input id="note-${esc(s.id)}" type="text" maxlength="200"></label>
    <div class="acts"><button class="btn primary" data-act="approve" data-id="${esc(s.id)}">${t("c_approve")}</button><button class="btn" data-act="reject" data-id="${esc(s.id)}">${t("c_reject")}</button></div>
  </article>`;
  return `<div class="clinician">
    <section class="p-head"><h2>${t("c_title")}</h2><p class="muted">${t("c_sub")}</p></section>
    <section class="card wide"><h3>${t("c_loops")}</h3><p class="muted small">${t("c_loops_sub", { n: num(c.openLoops.total) })}</p>
      <div class="tscroll"><table><thead><tr><th>${t("q_who")}</th><th>${state.lang === "ar" ? "الفحص" : "Screening"}</th><th>${t("s_flag")}</th><th>${state.lang === "ar" ? "إلى" : "Refer to"}</th><th></th></tr></thead><tbody>${c.openLoops.rows.slice(0, 15).map(loopRow).join("")}</tbody></table></div></section>
    <section class="card wide"><h3>${t("c_sugs")}</h3><p class="muted small">${t("c_sugs_sub", { n: num(c.suggestions.total) })}</p>
      <div class="sug-grid">${c.suggestions.rows.slice(0, 8).map(sugCard).join("")}</div></section>
    ${c.decided.length ? `<section class="card wide"><h3>${t("c_decided")}</h3><ul class="decided">${c.decided.map((d) => `<li><span class="badge ${d.status === "approved" ? "ok" : "neutral"}">${d.status === "approved" ? ICON.ok : ICON.pause}${d.status === "approved" ? t("c_approve") : t("c_reject")}</span> ${nameOf(d)} · ${esc(t(`c_kind.${d.kind}`))} · ${fmtDate(d.proposed_date)}${d.note ? ` · “${esc(d.note)}”` : ""}</li>`).join("")}</ul></section>` : ""}
  </div>`;
}

// ---------------------------------------------------------------- program

function barsChart(rows, { max = 100, target = null, fmt = (v) => `${v}%`, tip, W = 560, labW = 168 }) {
  const rowH = 26, padR = 52, H = rows.length * rowH + 22;
  const x = (v) => labW + (v / max) * (W - labW - padR);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="direction:ltr">
    ${[0, 0.25, 0.5, 0.75, 1].map((f) => f * max).map((g) => `<line x1="${x(g)}" x2="${x(g)}" y1="0" y2="${H - 18}" class="grid"/><text x="${x(g)}" y="${H - 4}" class="axis" text-anchor="middle">${g}</text>`).join("")}
    ${rows.map((r, i) => { const y = i * rowH + 4; return `<g class="hov" data-tip="${esc(tip(r))}"><rect x="0" y="${y - 2}" width="${W}" height="${rowH}" fill="transparent"/>
      <text x="${labW - 10}" y="${y + 14}" class="lab" text-anchor="end">${esc(r.label)}</text>
      ${r.value == null ? `<text x="${labW + 4}" y="${y + 14}" class="axis">${t("s_supp")}</text>` : `<rect x="${labW}" y="${y + 4}" width="${Math.max(2, x(r.value) - labW)}" height="14" rx="4" class="bar ${r.cls || ""}"/><text x="${x(r.value) + 6}" y="${y + 15}" class="val">${esc(fmt(r.value))}</text>`}</g>`; }).join("")}
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
  </svg>`;
}

function lineChart(hist) {
  const W = 560, H = 200, pl = 36, pr = 16, pt = 12, pb = 28;
  const n = hist.length;
  const max = Math.max(0.5, ...hist.map((h) => Math.max(h.rate, h.baseline_rate)));
  const x = (i) => pl + (n === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1));
  const y = (v) => H - pb - (v / max) * (H - pt - pb);
  const line = (k, cls) => `<polyline class="${cls}" points="${hist.map((h, i) => `${x(i)},${y(h[k])}`).join(" ")}"/>${hist.map((h, i) => `<circle cx="${x(i)}" cy="${y(h[k])}" r="4" class="${cls}-pt hov" data-tip="${esc(t("b_week", { w: h.week, rate: (100 * h.rate).toFixed(1), base: (100 * h.baseline_rate).toFixed(1) }))}"/>`).join("")}`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="direction:ltr" aria-label="${t("b_rates")}">
    ${[0, 0.25, 0.5, 0.75, 1].map((f) => f * max).map((g) => `<line x1="${pl}" x2="${W - pr}" y1="${y(g)}" y2="${y(g)}" class="grid"/><text x="${pl - 6}" y="${y(g) + 4}" class="axis" text-anchor="end">${Math.round(g * 100)}%</text>`).join("")}
    ${hist.map((h, i) => `<text x="${x(i)}" y="${H - 8}" class="axis" text-anchor="middle">${h.week}</text>`).join("")}
    ${line("baseline_rate", "base-line")}${line("rate", "ct-line")}
    <text x="${x(n - 1)}" y="${y(hist[n - 1].rate) - 9}" class="val" text-anchor="end">CareTrail ${(100 * hist[n - 1].rate).toFixed(0)}%</text>
    <text x="${x(n - 1)}" y="${y(hist[n - 1].baseline_rate) + 16}" class="axis" text-anchor="end">SMS ${(100 * hist[n - 1].baseline_rate).toFixed(0)}%</text>
  </svg>`;
}

const armLabel = (arm) => { const [c, f] = arm.split(":"); return `${t(`channel.${c === "app" ? "app" : c}`)} · ${t(`arm_framing.${f}`)}`; };
const ctxLabel = (ctx) => { const [l, g] = ctx.split("|"); const L = { arabic: t("language.ar"), english: t("language.en"), other: t("language.other") }[l]; return `${L} · ${g === "guardian" ? (state.lang === "ar" ? "ولي أمر طفل" : "parent of a child") : g}`; };

function programView() {
  const D = state.program, Q = state.queue, B = state.bandit;
  if (!D) return `<p>${t("loading")}</p>`;
  const kpi = (v, l, d, cls = "") => `<div class="kpi ${cls}"><b>${v}</b><span>${l}</span>${d ? `<small>${d}</small>` : ""}</div>`;
  const partRows = D.packages.map((k) => ({ label: pkgShort(k.package, state.lang), value: k.participation_pct, n: k.eligible, cls: k.participation_pct >= k.target_pct ? "met" : "" }));
  const coefs = D.model.coefficients.slice(0, 8);
  const cmax = Math.max(...coefs.map((c) => Math.abs(c.coef))) || 1;
  const fhirTotal = Object.values(D.fhir).reduce((a, b) => a + b, 0);
  return `<div class="program">
    <section class="p-head"><h2>${t("p_live_title")}</h2><p class="muted">${t("p_live_sub", { people: num(D.people), hh: num(D.households), fhir: num(fhirTotal), date: fmtDate(D.ref) })}</p></section>
    <section class="kpis">
      ${kpi(num(D.care_gaps), t("k_gaps"), "")}
      ${kpi(num(D.open_loops), t("k_open"), t("k_open_d"), "warn")}
      ${kpi(`${num(D.major.participation_pct)}%`, t("k_part"), t("k_part_d", { t: D.major.target_pct }))}
      ${kpi(`${num(D.referral_on_time_pct)}%`, t("k_ref"), t("k_ref_d", { t: 100 }), "warn")}
    </section>
    <div class="pgrid">
      <section class="card wide"><h3>${t("b_title")}</h3><p class="muted small">${t("b_sub")}</p>
        <div class="acts"><button class="btn primary" data-act="week" ${state.busy ? "disabled" : ""}>${state.busy ? t("b_running") : t("b_run")}</button></div>
        ${B.history.length ? `<div class="b-grid"><div><h4>${t("b_rates")}</h4>${lineChart(B.history)}<p class="small">${t("b_week", { w: B.week, rate: (100 * B.history[B.history.length - 1].rate).toFixed(1), base: (100 * B.history[B.history.length - 1].baseline_rate).toFixed(1) })}</p></div>
          <div class="tscroll"><table><thead><tr><th>${t("b_ctx")}</th><th>${t("b_best")}</th><th class="n">${t("b_n")}</th></tr></thead><tbody>${B.table.map((r) => `<tr><td>${esc(ctxLabel(r.context))}</td><td>${r.n ? esc(armLabel(r.best)) : "–"}</td><td class="n">${num(r.n)}</td></tr>`).join("")}</tbody></table></div></div>` : `<p class="muted">${t("b_none")}</p>`}
      </section>
      <section class="card wide"><h3>${t("q_title")}</h3><p class="muted small">${t("q_sub")}</p>
        <div class="tscroll"><table><thead><tr><th>${t("q_who")}</th><th>${t("q_gaps")}</th><th class="n">${t("q_risk")}</th><th>${t("q_why")}</th><th>${t("q_rec")}</th><th></th></tr></thead>
        <tbody>${Q.rows.map((r) => `<tr><td><span class="mono">${r.pseudonym}</span><br><span class="badge t${r.tier}">${ICON[r.tier]}${r.proactive ? t("q_proactive") : t(`tier.${r.tier}`)}</span>${r.booked ? `<br><span class="badge ok">${ICON.ok}${state.lang === "ar" ? "محجوز" : "Booked"}</span>` : ""}</td>
          <td>${r.gaps.map((g) => esc(pkgShort(g, state.lang))).join(", ")}</td><td class="n">${num(Math.round(r.risk * 100))}%</td>
          <td class="small">${r.drivers.map((d) => esc(driverText(d.label, state.lang))).join(" · ")}</td>
          <td class="small">${esc(armLabel(r.recommended))}<br><span class="muted">${t(`language.${r.language}`)}</span>${r.interpreter ? `<br><span class="badge neutral">${ICON.info}${t("q_interp")}</span>` : ""}</td>
          <td><button class="btn small" data-act="openrec" data-p="${r.pseudonym}">${t("q_open")}</button></td></tr>`).join("")}</tbody></table></div>
        <div class="acts"><button class="btn small" data-act="qprev" ${state.qOffset ? "" : "disabled"}>‹</button><span class="small muted">${num(state.qOffset + 1)}–${num(Math.min(state.qOffset + 15, Q.total))} / ${num(Q.total)}</span><button class="btn small" data-act="qnext" ${state.qOffset + 15 < Q.total ? "" : "disabled"}>›</button></div>
      </section>
      <section class="card"><h3>${t("c_part_title")}</h3><p class="muted small">${t("c_part_sub", { t: D.major.target_pct })}</p>
        <div class="tscroll"><div class="wchart-s">${barsChart(partRows, { target: D.major.target_pct, tip: (r) => `${r.label}: ${r.value ?? t("s_supp")}% · ${t("eligible_n", { n: num(r.n) })}`, W: 560, labW: 170 })}</div></div></section>
      <section class="card"><h3>${t("m_live")}</h3><p class="purpose">${ICON.info}<span>${t("m_purpose")}</span></p>
        <p class="small muted">${t("m_version", { v: D.model.version, n: num(D.model.n_train), when: new Date(D.model.trained_at).toLocaleString(loc()) })}</p>
        <dl class="mc"><div><dt>${t("m_auc")} · ${t("m_brier")} · ${t("m_ece")}</dt><dd class="mono">${D.model.auc} · ${D.model.brier} · ${D.model.ece}</dd></div></dl>
        <h4>${t("m_cal")}</h4><div class="calwrap">${calChart(D.model.calibration)}</div>
        <h4>${t("m_drivers")}</h4>
        <ul class="drivers">${coefs.map((c) => `<li><span>${esc(driverText(c.label, state.lang))}</span><span class="dbar"><i class="${c.coef > 0 ? "up" : "down"}" style="width:${(Math.abs(c.coef) / cmax) * 100}%"></i></span><span class="small muted">${c.coef > 0 ? t("m_raises") : t("m_lowers")}</span></li>`).join("")}</ul>
        <div class="acts"><button class="btn small" data-act="retrain">${t("m_retrain")}</button></div>
      </section>
      <section class="card wide"><h3>${t("s_title")}</h3><p class="muted small">${t("s_sub", { k: D.min_cell })}</p>
        <div class="tscroll"><table><thead><tr><th>${t("s_seg")}</th><th class="n">${t("s_n")}</th><th class="n">${t("s_rec")}</th><th class="n">${state.lang === "ar" ? "عدم الإكمال الفعلي" : "Observed lapse"}</th><th class="n">${t("s_gap")}</th><th>${t("s_flag")}</th></tr></thead>
        <tbody>${D.safeguards.map((s) => `<tr><td>${esc(segText(s.segment, state.lang))}: <b>${esc(segText(s.group, state.lang))}</b></td>
          ${s.suppressed ? `<td class="n" colspan="4">${t("s_supp")}</td>` : `<td class="n">${num(s.n)}</td><td class="n">${num(s.prioritised_pct)}%</td><td class="n">${num(s.lapse_observed_pct)}%</td><td class="n">${s.calibration_gap_pts > 0 ? "+" : ""}${num(s.calibration_gap_pts)}</td>`}
          <td>${s.needs_local_recalibration ? `<span class="badge t2">${ICON[2]}${t("s_recal")}</span>` : s.suppressed ? `<span class="badge neutral">${ICON.lock}${t("s_supp")}</span>` : `<span class="badge ok">${ICON.ok}${t("s_ok")}</span>`}</td></tr>`).join("")}</tbody></table></div>
      </section>
      <section class="card wide">${logPanel("program", t("prog_log"))}</section>
      <section class="card wide"><div class="acts"><button class="btn" data-act="reset-ask">${t("reset")}</button></div></section>
    </div></div>`;
}

// ---------------------------------------------------------------- how it works

function howView() {
  const box = (n, title, body) => `<div class="hbox"><span class="hn">${n}</span><h3>${title}</h3><p>${body}</p></div>`;
  return `<div class="how"><h2>${t("h_title")}</h2><p class="muted">${t("h_sub")}</p>
    <div class="hgrid">${box(1, t("h1_t"), t("h1_b"))}<div class="hsplit">${box(2, t("h2_t"), t("h2_b"))}${box(3, t("h3_t"), t("h3_b"))}</div>${box(4, t("h4_t"), t("h4_b"))}</div>
    <p>${t("h4_live")} ${t("pilot_login")}</p><p>${t("h_data")}</p><p class="muted">${t("h_limits")}</p>
    <p><a href="/fhir/metadata" target="_blank" rel="noopener">${t("fhir_link")}</a> · <a href="https://github.com/bbahat/caretrail" target="_blank" rel="noopener">GitHub</a></p></div>`;
}

// ---------------------------------------------------------------- modal

function modal() {
  const m = state.modal;
  if (!m) return "";
  let body = "";
  if (m.type === "book") {
    body = `<h3 id="mt">${t("book_title", { title: esc(m.title) })}</h3><p class="muted">${t("book_for", { name: esc(nm(personOf(m.item.personId)?.name)) })}</p>
      ${m.slots == null ? `<p>${t("loading")}</p>` : m.slots.length ? `<p><b>${t("book_pick")}</b></p><div class="slots">${m.slots.slice(0, 6).map((s, i) => `<label class="slot"><input id="slot-${i}" type="radio" name="slot" value="${s.id}" ${i === 0 ? "checked" : ""}><span>${fmtSlot(s.start)}<br><span class="muted small">${esc(s.clinic)}</span></span></label>`).join("")}</div>` : `<p>${t("no_slots")}</p>`}
      <div class="acts end"><button class="btn" data-act="close">${t("cancel")}</button>${m.slots?.length ? `<button class="btn primary" data-act="confirm-book">${t("book_confirm")}</button>` : ""}</div>`;
  } else if (m.type === "snooze") {
    const canDecline = m.item.program === "IFHAS" && m.item.decision === "population";
    body = `<h3 id="mt">${t("snooze_title")}: ${esc(m.title)}</h3><div class="opts"><button class="btn block" data-act="confirm-snooze">${t("snooze_30")}</button>
      ${canDecline ? `<button class="btn block" data-act="confirm-decline">${t("snooze_decline")}</button><p class="muted small">${t("decline_note")}</p>` : ""}</div>
      <div class="acts end"><button class="btn" data-act="close">${t("cancel")}</button></div>`;
  } else if (m.type === "openrec") {
    body = m.result ? `<h3 id="mt">${esc(m.p)}</h3><dl class="mc"><div><dt>${state.lang === "ar" ? "الأسرة" : "Household"}</dt><dd>${esc(nm(m.result.contact.household))}</dd></div><div><dt>${state.lang === "ar" ? "الشخص" : "Person"}</dt><dd>${esc(nm(m.result.contact.member))}</dd></div><div><dt>${t("q_how")}</dt><dd>${t(`channel.${m.result.contact.preferred_channel}`)} · ${t(`language.${m.result.contact.preferred_language}`)}</dd></div></dl><p class="vres ok">${ICON.shield}<span>${t("opened", { i: m.result.ledgerIndex })}</span></p><div class="acts end"><button class="btn primary" data-act="close">OK</button></div>`
      : `<h3 id="mt">${t("open_title", { p: m.p })}</h3><p><b>${t("open_purpose")}</b></p>
      <div class="slots">${["purpose_outreach", "purpose_followup", "purpose_quality"].map((k, i) => `<label class="slot"><input id="purpose-${i}" type="radio" name="purpose" value="${k}" ${i === 0 ? "checked" : ""}><span>${t(k)}</span></label>`).join("")}</div>
      <div class="acts end"><button class="btn" data-act="close">${t("cancel")}</button><button class="btn primary" data-act="confirm-open">${t("open_confirm")}</button></div>`;
  } else if (m.type === "reset") {
    body = `<h3 id="mt">${t("reset")}</h3><p>${t("reset_confirm")}</p><div class="acts end"><button class="btn" data-act="close">${t("cancel")}</button><button class="btn primary" data-act="confirm-reset">${t("yes_reset")}</button></div>`;
  } else if (m.type === "refer") {
    body = `<h3 id="mt">${t("c_refer")}</h3><label class="note-in"><span class="small muted">${state.lang === "ar" ? "إلى" : "Refer to"}</span><input id="refer-to" type="text" value="${esc(m.s)}"></label>
      <label class="note-in"><span class="small muted">${t("c_note")}</span><input id="refer-note" type="text" maxlength="200"></label>
      <div class="acts end"><button class="btn" data-act="close">${t("cancel")}</button><button class="btn primary" data-act="confirm-refer">${t("c_refer")}</button></div>`;
  }
  return `<div class="scrim" data-act="close"></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt">${body}</div>`;
}

// ---------------------------------------------------------------- render + events

let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; render(); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

const root = document.getElementById("app");
let tipEl;
function render() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = t("dir");
  let main;
  if (state.error && !state.meta) main = `<p class="vres bad">${esc(t("error", { msg: state.error }))}</p>`;
  else if (!state.meta) main = `<p>${t("loading")}</p>`;
  else if (state.view === "how") main = howView();
  else if (!state.user) main = picker();
  else if (state.view === "family") main = familyView();
  else if (state.view === "clinician") main = clinicianView();
  else if (state.view === "program") main = programView();
  else main = picker();
  root.innerHTML = `${header()}<main>${main}</main><footer class="foot">${t("footer")}</footer>${modal()}${state.toast ? `<div class="toast" role="status">${esc(state.toast)}</div>` : ""}<div class="tip" hidden></div>`;
  tipEl = root.querySelector(".tip");
  const first = root.querySelector(".modal input, .modal button.primary");
  if (first) first.focus();
}
function toast(msg) {
  state.toast = msg; render();
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { state.toast = null; render(); }, 4200);
}
async function run(fn) {
  try { await fn(); } catch (e) { state.modal = null; toast(t("error", { msg: e.message })); }
  render();
}
const findItem = (id) => state.family.members.flatMap((m) => m.items).find((i) => i.id === id);
const itemTitleFor = (it) => (it.status === "doctor_recommended" ? it.title : itemTitle(it, state.lang));

root.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-act]");
  if (!el || el.tagName === "SELECT" || el.tagName === "INPUT") return;
  const act = el.dataset.act;
  run(async () => {
    if (act === "lang") { state.lang = state.lang === "en" ? "ar" : "en"; store.set("ct_lang", state.lang); }
    else if (act === "view") { state.view = el.dataset.v; window.scrollTo(0, 0); }
    else if (act === "signin") await signIn(el.dataset.p);
    else if (act === "fresh") { await api("/api/demo/reset", { method: "POST" }); state.firstCheckpoint = {}; state.ledger = {}; if (state.user) await load(); toast(t("fresh_done")); }
    else if (act === "install") { installEvt.prompt(); installEvt = null; }
    else if (act === "export") {
      const b = await api("/api/family/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: "application/fhir+json" }));
      const aEl = document.createElement("a"); aEl.href = url; aEl.download = `caretrail-${state.user.hh}-fhir.json`; document.body.appendChild(aEl); aEl.click(); aEl.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    else if (act === "tab") { state.tab = el.dataset.v; if (state.tab === "log") await loadLedger(); }
    else if (act === "more") state.showAll = !state.showAll;
    else if (act === "why") state.open[el.dataset.id] = !state.open[el.dataset.id];
    else if (act === "member") { state.tab = "passport"; render(); document.getElementById("m-" + el.dataset.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (act === "book") {
      const it = findItem(el.dataset.id);
      state.modal = { type: "book", item: it, title: itemTitleFor(it), slots: null }; render();
      state.modal.slots = await api(`/api/family/slots?service=${it.service}`);
    } else if (act === "snooze") { const it = findItem(el.dataset.id); state.modal = { type: "snooze", item: it, title: itemTitleFor(it) }; }
    else if (act === "close") state.modal = null;
    else if (act === "confirm-book") {
      const it = state.modal.item;
      const slotId = root.querySelector('input[name="slot"]:checked').value;
      const r = await api("/api/family/book", { method: "POST", body: { slotId, patient: it.personId, itemId: it.id, title: state.modal.title } });
      state.family = r.view; state.modal = null; toast(t("booked", { slot: fmtSlot(r.appointment.start) }));
    } else if (act === "cancel") { state.family = await api("/api/family/cancel", { method: "POST", body: { appointmentId: el.dataset.id } }); }
    else if (act === "confirm-snooze") { const it = state.modal.item; state.family = await api("/api/family/snooze", { method: "POST", body: { itemId: it.id, patient: it.personId, days: 30 } }); state.modal = null; }
    else if (act === "confirm-decline") { const it = state.modal.item; state.family = await api("/api/family/decline", { method: "POST", body: { patient: it.personId, key: it.key } }); state.modal = null; toast(t("decline_note")); }
    else if (act === "verify") {
      const scope = el.dataset.scope;
      state.verify[scope] = { running: true }; render();
      state.verify[scope] = await verifyLog(state.ledger[scope], state.firstCheckpoint[scope]);
    } else if (act === "tamper") {
      const scope = el.dataset.scope;
      const data = state.ledger[scope];
      const target = data.entries[data.entries.length - 1];
      state.tampered = { index: target.entry.i, original: target.entry };
      target.entry = { ...target.entry, purpose: target.entry.purpose === "purpose_quality" ? "purpose_outreach" : "purpose_quality" };
      delete state.verify[scope];
    } else if (act === "restore") {
      const data = state.ledger[el.dataset.scope];
      const target = data.entries.find((e) => e.entry.i === state.tampered.index);
      target.entry = state.tampered.original; state.tampered = null; delete state.verify[el.dataset.scope];
    } else if (act === "refer") state.modal = { type: "refer", p: el.dataset.p, k: el.dataset.k, s: el.dataset.s };
    else if (act === "confirm-refer") {
      const m = state.modal;
      state.clinician = await api("/api/clinician/referral", { method: "POST", body: { patient: m.p, key: m.k, decision: "refer", specialist: root.querySelector("#refer-to").value, note: root.querySelector("#refer-note").value } });
      state.modal = null;
    } else if (act === "manage" || act === "complete") state.clinician = await api("/api/clinician/referral", { method: "POST", body: { patient: el.dataset.p, key: el.dataset.k, decision: act } });
    else if (act === "approve" || act === "reject") {
      const note = root.querySelector(`#note-${CSS.escape(el.dataset.id)}`)?.value;
      state.clinician = await api("/api/clinician/suggestion", { method: "POST", body: { id: el.dataset.id, decision: act, note } });
    } else if (act === "openrec") state.modal = { type: "openrec", p: el.dataset.p };
    else if (act === "confirm-open") {
      const purpose = root.querySelector('input[name="purpose"]:checked').value;
      state.modal.result = await api("/api/program/open", { method: "POST", body: { pseudonym: state.modal.p, purpose } });
      await loadLedger();
    } else if (act === "week") { state.busy = true; render(); try { await api("/api/program/week", { method: "POST" }); await load(); } finally { state.busy = false; } }
    else if (act === "retrain") { await api("/api/program/retrain", { method: "POST" }); await load(); }
    else if (act === "qnext") { state.qOffset += 15; state.queue = await api(`/api/program/queue?offset=${state.qOffset}`); }
    else if (act === "qprev") { state.qOffset = Math.max(0, state.qOffset - 15); state.queue = await api(`/api/program/queue?offset=${state.qOffset}`); }
    else if (act === "reset-ask") state.modal = { type: "reset" };
    else if (act === "confirm-reset") { await api("/api/admin/reset", { method: "POST" }); state.modal = null; state.firstCheckpoint = {}; await signIn(state.user.id); }
  });
});

root.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.dataset.act === "switch") return run(() => signIn(el.value));
  if (el.dataset.act === "consent") {
    return run(async () => {
      state.family = await api("/api/family/consent", { method: "POST", body: { patient: el.dataset.id, category: el.dataset.k, value: el.checked } });
      toast(state.lang === "ar" ? "تم تحديث الخطوات التالية وتسجيل التغيير." : "Next steps updated and the change logged.");
    });
  }
});
root.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && state.modal) { state.modal = null; render(); } });
root.addEventListener("pointermove", (ev) => {
  const g = ev.target.closest?.(".hov");
  if (!tipEl) return;
  if (!g) { tipEl.hidden = true; return; }
  tipEl.textContent = g.dataset.tip; tipEl.hidden = false;
  tipEl.style.left = Math.min(ev.clientX + 14, window.innerWidth - tipEl.offsetWidth - 8) + "px";
  tipEl.style.top = ev.clientY + 16 + "px";
});

render();
boot();
