// CareTrail guideline engine.
//
// Turns a household record plus data/rules.json into care gaps: what each
// person is due for, what is overdue, which abnormal results have no
// completed follow-up, and why. It runs entirely on the device in the app
// and in Node for population analytics, so both use the same logic.
//
// Every item carries reason codes (for translation), the factors behind it,
// the data categories it used, its rule source, and whether it is a
// population-level prioritisation or a decision for the clinician.

const DAY = 86400000;
const YEAR_DAYS = 365.25;
const MONTH_DAYS = 30.44;
// 15 working days (IFHAS App. 9) approximated as 21 calendar days.
const ADULT_REFERRAL_DAYS = 21;
// No completion deadline is given for adult referrals; CareTrail flags after 30 days.
const ADULT_REFERRAL_COMPLETION_DAYS = 30;
const OVERDUE_GRACE_DAYS = 90;
const DUE_SOON_DAYS = 60;
const DECLINE_RESPECT_DAYS = 365;

export const TIERS = {
  1: "Needs follow-up now",
  2: "Higher priority",
  3: "Overdue",
  4: "Due now",
  5: "Coming up",
};

const d = (s) => (s ? new Date(s + "T00:00:00Z") : null);
const iso = (t) => (t ? new Date(t).toISOString().slice(0, 10) : null);
const days = (a, b) => Math.floor((b - a) / DAY);
const addDays = (t, n) => new Date(t.getTime() + n * DAY);
const addYears = (t, y) => addDays(t, Math.round(y * YEAR_DAYS));
const addMonths = (t, m) => addDays(t, Math.round(m * MONTH_DAYS));
const ageYears = (birth, ref) => days(birth, ref) / YEAR_DAYS;
const ageMonths = (birth, ref) => days(birth, ref) / MONTH_DAYS;

const FACTOR_TEXT = {
  cond_diabetes: "Has diabetes",
  cond_hypertension: "Has high blood pressure",
  cond_high_cholesterol: "Has high cholesterol",
  cond_obesity: "Obesity",
  cond_copd: "COPD",
  cond_type1_diabetes: "Type 1 diabetes",
  premature: "Born prematurely",
  fh_diabetes: "Family history of diabetes",
  fh_hypertension: "Family history of high blood pressure",
  fh_heart_disease: "Family history of heart disease",
  fh_cancer: "Family history of cancer",
  tobacco_current: "Currently uses tobacco",
  tobacco_former: "Former tobacco use",
  lung_high_risk: "Meets the IFHAS high-risk smoking criteria",
  gen_brca: "Genomic result: BRCA1/2 variant (shared with consent)",
  gen_lynch: "Genomic result: Lynch syndrome (shared with consent)",
  gen_fh: "Genomic result: familial hypercholesterolemia (shared with consent)",
  wear_low_steps: "Low daily step count from your wearable",
  wear_short_sleep: "Short average sleep from your wearable",
  never_screened: "No record of this screening",
  long_overdue: "Overdue by more than a year",
  dev_screening: "Includes developmental and autism screening",
  newborn_hearing_missed: "Newborn hearing test was not completed",
};

const CATEGORY = {
  cond: "clinical", premature: "clinical", fh: "family_history", tobacco: "lifestyle",
  lung: "lifestyle", gen: "genomic", wear: "wearable", never: "screening_history",
  long: "screening_history", dev: "guideline", newborn: "screening_history",
};

function factor(code) {
  const cat = CATEGORY[code.split("_")[0]] || "guideline";
  return { code, category: cat, text: FACTOR_TEXT[code] || code };
}

// -- adult (IFHAS) ------------------------------------------------------------

function lungHighRisk(p) {
  const t = p.tobacco;
  if (!t || !t.status) return null; // unknown -> cannot decide
  const quitOk = t.status === "current" || (t.years_since_quit != null && t.years_since_quit < 15);
  const extra = (p.conditions || []).includes("copd") || (p.family_history || []).includes("cancer");
  return (t.pack_years >= 30 && quitOk) || t.water_pipe_years >= 20 || (t.pack_years >= 20 && quitOk && extra);
}

function genomic(p) {
  return p.consent?.genomic ? p.genomic_findings || [] : [];
}

function riskFactors(pkgId, p) {
  const c = new Set(p.conditions || []);
  const fh = new Set(p.family_history || []);
  const g = genomic(p);
  const w = p.consent?.wearables ? p.wearable : null;
  const smoker = p.tobacco?.status === "current" ? "tobacco_current" : p.tobacco?.status === "former" ? "tobacco_former" : null;
  const f = [];
  const add = (cond, code) => cond && f.push(factor(code));
  if (pkgId === "major") {
    ["diabetes", "hypertension", "high_cholesterol", "obesity"].forEach((x) => add(c.has(x), "cond_" + x));
    ["diabetes", "hypertension", "heart_disease"].forEach((x) => add(fh.has(x), "fh_" + x));
    add(smoker, smoker);
    add(g.includes("Familial hypercholesterolemia"), "gen_fh");
    add(w && w.steps_per_day < 5000, "wear_low_steps");
    add(w && w.sleep_hours < 6, "wear_short_sleep");
  }
  if (["breast_cbe", "breast_cbe_gail", "mammography"].includes(pkgId)) {
    add(fh.has("cancer"), "fh_cancer");
    add(g.includes("BRCA1/2 pathogenic variant"), "gen_brca");
  }
  if (pkgId === "colorectal") {
    add(fh.has("cancer"), "fh_cancer");
    add(g.includes("Lynch syndrome"), "gen_lynch");
  }
  if (pkgId === "vision") add(c.has("diabetes"), "cond_diabetes");
  if (pkgId === "oral") {
    add(c.has("diabetes"), "cond_diabetes");
    add(smoker, smoker);
  }
  if (pkgId === "lung_ldct") f.push(factor("lung_high_risk"));
  if (pkgId === "aaa") add(smoker, smoker || "tobacco_former");
  return f;
}

function specialistFor(pkgId, rules) {
  const map = {
    major: "Family physician / internal medicine", vision: "Ophthalmologist", oral: "Dentist",
    hearing_dementia_50_64: "ENT or neurologist", hearing_dementia_65_75: "ENT or geriatrician",
    cervical_pap: "Gynecologist", cervical_hpv: "Gynecologist", breast_cbe: "Family physician or gynecologist",
    breast_cbe_gail: "Family medicine, gynecology or breast surgery", mammography: "Family medicine, gynecology or breast surgery",
    female_repro: "Gynecologist", male_repro: "Urologist", colorectal: "Gastroenterologist",
    dexa: "Endocrinologist or family physician", lung_ldct: "Pulmonologist", aaa: "Vascular surgeon",
  };
  return map[pkgId] || "Your doctor";
}

function packageApplies(pkg, p, age) {
  const [lo, hi] = pkg.age;
  if (age < lo || age >= hi + 1) return { applies: false };
  if (pkg.sex !== "any" && pkg.sex !== p.sex) return { applies: false };
  if (pkg.id === "lung_ldct") {
    const hr = lungHighRisk(p);
    if (hr === null) return { applies: "uncertain" };
    if (!hr) return { applies: false };
  }
  if (pkg.id === "aaa" && (!p.tobacco || p.tobacco.status === "never")) return { applies: false };
  return { applies: true };
}

function intervalYears(pkg, rec) {
  if (pkg.once_in_lifetime) return Infinity;
  if (pkg.id === "colorectal") {
    const opt = pkg.options.find((o) => o.id === (rec?.modality || "fit"));
    return opt.interval_years;
  }
  return pkg.interval_years;
}

function evaluateAdultPackage(pkg, p, ref, rules) {
  const rec = (p.screening || {})[pkg.id] || {};
  const last = d(rec.last_done);
  const base = {
    id: `${p.id}:${pkg.id}`, personId: p.id, program: "IFHAS", key: pkg.id, title: pkg.name,
    lastDone: rec.last_done || null, source: pkg.source, decision: "population",
    factors: riskFactors(pkg.id, p), reasons: [],
  };

  const declined = d(rec.declined_on);
  if (declined && days(declined, ref) < DECLINE_RESPECT_DAYS) {
    return { ...base, status: "declined", tier: null,
      reasons: [{ code: "declined", date: rec.declined_on, until: iso(addDays(declined, DECLINE_RESPECT_DAYS)) }] };
  }
  if (rec.result === "insufficient") {
    return { ...base, status: "recall", tier: 1, reasons: [{ code: "insufficient_result", date: rec.last_done }], source: "IFHAS 4.7.1" };
  }
  if (rec.result === "abnormal") {
    const ref_ = rec.referral || {};
    const specialist = specialistFor(pkg.id, rules);
    if (!ref_.made && days(last, ref) > ADULT_REFERRAL_DAYS) {
      return { ...base, status: "open_loop", tier: 1, decision: "clinical", specialist, source: "IFHAS 4.9.3, App. 8, App. 9",
        reasons: [{ code: "abnormal_no_referral", date: rec.last_done, specialist, limit: "15 working days" }] };
    }
    if (ref_.made && !ref_.completed && days(d(ref_.made_on), ref) > ADULT_REFERRAL_COMPLETION_DAYS) {
      return { ...base, status: "open_loop", tier: 1, decision: "clinical", specialist, source: "IFHAS 4.9.3, App. 8",
        reasons: [{ code: "referral_not_completed", date: ref_.made_on, specialist }] };
    }
    if (ref_.made && !ref_.completed) {
      // Referral made and still within the expected window: the next step is the specialist visit.
      return { ...base, status: "referral_pending", tier: 2, decision: "clinical", specialist: ref_.specialist || specialist, source: "IFHAS 4.9.3, App. 8",
        reasons: [{ code: "referral_made", date: ref_.made_on, specialist: ref_.specialist || specialist, by: ref_.requester || null }] };
    }
  }

  const interval = intervalYears(pkg, rec);
  const factors = [...base.factors];
  let status, dueDate = null;
  if (!last) {
    status = "overdue";
    factors.push(factor("never_screened"));
    base.reasons.push({ code: "never_screened" });
  } else if (interval === Infinity) {
    return { ...base, status: "up_to_date", tier: null, reasons: [{ code: "done_once", date: rec.last_done }] };
  } else {
    const due = addYears(last, interval);
    dueDate = iso(due);
    const late = days(due, ref);
    if (late < -DUE_SOON_DAYS) status = "up_to_date";
    else if (late < 0) status = "due_soon";
    else if (late < OVERDUE_GRACE_DAYS) status = "due";
    else status = "overdue";
    if (late > 365) factors.push(factor("long_overdue"));
    base.reasons.push({ code: status === "up_to_date" ? "next_due" : status === "due_soon" ? "due_on" : "due_since", date: dueDate, interval_years: interval });
  }
  const elevated = base.factors.length > 0 || pkg.requires_high_risk;
  const tier = { up_to_date: null, due_soon: 5, due: 4, overdue: elevated ? 2 : 3 }[status];
  if (tier === 4 && elevated) base.reasons.push({ code: "elevated_risk" });
  const priority = (tier ? 10 - tier : 0) + factors.length * 0.5 + (last ? Math.max(0, days(addYears(last, interval), ref)) / 365 : 1);
  return { ...base, factors, status, tier, dueDate, priority };
}

function evaluateAdult(p, hh, ref, rules) {
  const items = [];
  const age = ageYears(d(p.birth_date), ref);
  const elig = rules.ifhas.eligibility;
  if (hh.insurance !== elig.insurance) {
    items.push({ id: `${p.id}:ifhas`, personId: p.id, program: "IFHAS", key: "ifhas_eligibility", title: "IFHAS comprehensive screening",
      status: "not_eligible", tier: null, decision: "population", source: "IFHAS 4.5", factors: [],
      reasons: [{ code: "not_thiqa", insurance: hh.insurance }] });
    return items;
  }
  if (age < elig.program_age_range[0] || age >= elig.program_age_range[1] + 1) return items;
  for (const pkg of rules.ifhas.packages) {
    const a = packageApplies(pkg, p, age);
    if (a.applies === "uncertain") {
      items.push({ id: `${p.id}:${pkg.id}`, personId: p.id, program: "IFHAS", key: pkg.id, title: pkg.name,
        status: "uncertain", tier: null, decision: "clinical", source: pkg.source, factors: [],
        reasons: [{ code: "insufficient_data", missing: "tobacco history" }] });
      continue;
    }
    if (!a.applies) continue;
    items.push(evaluateAdultPackage(pkg, p, ref, rules));
  }
  if (p.sex === "female" && p.married && age >= 18 && age < 46) {
    items.push({ id: `${p.id}:preconception`, personId: p.id, program: "IFHAS", key: "preconception", title: "Preconception counselling",
      status: "info", tier: null, decision: "clinical", source: "IFHAS 4.8.2.3", factors: [], reasons: [{ code: "preconception" }] });
  }
  for (const g of genomic(p)) {
    items.push({ id: `${p.id}:genomic:${g}`, personId: p.id, program: "GENOMIC", key: "genomic_review", title: "Genomic result on file",
      status: "info", tier: null, decision: "clinical", source: "Consented genomic data", factors: [],
      reasons: [{ code: "genomic_review", finding: g }] });
  }
  return items;
}

// -- child (Well-Child Visits) ------------------------------------------------

function componentsAt(month, rules) {
  return rules.wcv.components
    .filter((c) => c.months === "all" || c.months.includes(month) || (c.catch_up_months || []).includes(month))
    .map((c) => ({ id: c.id, name: c.name }));
}

const DEV = new Set([18, 24]);

function evaluateChild(p, ref, rules) {
  const items = [];
  const birth = d(p.birth_date);
  const m = ageMonths(birth, ref);
  const sched = rules.wcv.schedule_months;
  if (m < 1 || m >= 73) return items;
  const attended = new Set(p.wcv?.attended_months || []);
  const res = p.wcv?.results || {};
  const current = Math.max(...sched.filter((x) => x <= m));
  const next = sched.find((x) => x > m);
  const childFactors = [];
  (p.conditions || []).forEach((c) => FACTOR_TEXT["cond_" + c] && childFactors.push(factor("cond_" + c)));
  if (p.premature) childFactors.push(factor("premature"));

  const missed = sched.filter((x) => x < current && !attended.has(x));
  if (missed.length) {
    const devMissed = missed.some((x) => DEV.has(x) && !res[`mchat_r_${x}`]);
    items.push({ id: `${p.id}:wcv_missed`, personId: p.id, program: "WCV", key: "wcv_missed", title: "Missed Well-Child visits",
      status: "overdue", tier: devMissed ? 2 : 3, decision: "population", source: "WCV 3.2.3, 3.10.1.3",
      factors: devMissed ? [factor("dev_screening")] : [],
      reasons: [{ code: "missed_visits", months: missed, catch_up: true }], priority: 6 + missed.length });
  }

  const windowStart = addMonths(birth, current);
  const windowEnd = next ? addMonths(birth, next) : addMonths(birth, 73);
  if (!attended.has(current)) {
    const comps = componentsAt(current, rules);
    const dev = DEV.has(current);
    items.push({ id: `${p.id}:wcv_${current}`, personId: p.id, program: "WCV", key: `wcv_${current}`, title: `${current < 24 ? current + "-month" : current / 12 + "-year"} Well-Child visit`,
      status: "due", tier: dev || childFactors.length ? 2 : 4, decision: "population", source: "WCV 3.2.3, App. 1",
      dueDate: iso(windowStart), windowEnd: iso(windowEnd), components: comps,
      factors: [...childFactors, ...(dev ? [factor("dev_screening")] : [])],
      reasons: [{ code: "visit_due", month: current, until: iso(windowEnd) }], priority: 7 });
  } else if (next && days(ref, addMonths(birth, next)) <= 30) {
    items.push({ id: `${p.id}:wcv_${next}`, personId: p.id, program: "WCV", key: `wcv_${next}`, title: `${next < 24 ? next + "-month" : next / 12 + "-year"} Well-Child visit`,
      status: "due_soon", tier: 5, decision: "population", source: "WCV 3.2.3", dueDate: iso(addMonths(birth, next)),
      components: componentsAt(next, rules), factors: childFactors, reasons: [{ code: "due_on", date: iso(addMonths(birth, next)) }], priority: 2 });
  }

  // Open loops from child screening results.
  const openLoop = (key, title, r, limitDays, specialist, source, resultKey = key) => {
    const ref_ = r.referral || {};
    const anchor = d(ref_.made ? ref_.made_on : r.done_on);
    if (ref_.completed) return;
    if (days(anchor, ref) <= limitDays) {
      if (ref_.made) items.push({ id: `${p.id}:${key}`, personId: p.id, program: "WCV", key, resultKey, title, status: "referral_pending", tier: 2,
        decision: "clinical", specialist: ref_.specialist || specialist, source, factors: [],
        reasons: [{ code: "referral_made", date: iso(anchor), specialist: ref_.specialist || specialist, by: ref_.requester || null }], priority: 9 });
      return;
    }
    items.push({ id: `${p.id}:${key}`, personId: p.id, program: "WCV", key, resultKey, title, status: "open_loop", tier: 1,
      decision: "clinical", specialist, source, factors: [],
      reasons: [{ code: ref_.made ? "referral_not_completed" : "abnormal_no_referral", date: iso(anchor), specialist, limit: limitDays % 7 === 0 && limitDays > 7 ? `${limitDays / 7} weeks` : `${limitDays} days` }],
      priority: 9 });
  };
  for (const mm of [18, 24]) {
    const r = res[`mchat_r_${mm}`];
    if (r && r.score >= 3) {
      const limit = r.score >= 8 ? 14 : 28;
      openLoop(`mchat_${mm}`, `Autism screening follow-up (${mm} months)`, r, limit, "Child neurodevelopment clinic and speech therapy", "WCV App. 5.1", `mchat_r_${mm}`);
    }
  }
  if (res.idaq_18?.positive) openLoop("idaq_18", "Development screening follow-up", res.idaq_18, 28, "Pediatric neurologist or neurodevelopment clinic", "WCV 3.8.4.2");
  if (res.cbc && res.cbc.hb_g_dl < 11) openLoop("cbc", "Anemia follow-up", res.cbc, 7, "Pediatrician", "WCV 3.6.3, 3.9.1.3");
  for (const mm of [48, 60, 72]) {
    const r = res[`hearing_pta_${mm}`];
    if (r && r.passed === false) openLoop(`hearing_${mm}`, "Hearing follow-up", r, 7, "ENT / audiology", "WCV 3.3.4, 3.9.1.3", `hearing_pta_${mm}`);
  }
  if (p.newborn_hearing && p.newborn_hearing !== "passed" && !res.hearing_infant) {
    items.push({ id: `${p.id}:hearing_infant`, personId: p.id, program: "WCV", key: "hearing_infant", title: "Hearing test (missed at birth)",
      status: "overdue", tier: 2, decision: "population", source: "WCV 3.3.4",
      factors: [factor("newborn_hearing_missed")], reasons: [{ code: "newborn_hearing", value: p.newborn_hearing }], priority: 8 });
  }
  if (m < 36 && childFactors.length) {
    items.push({ id: `${p.id}:bp_under3`, personId: p.id, program: "WCV", key: "bp_under3", title: "Blood pressure checks before age 3",
      status: "info", tier: null, decision: "clinical", source: "WCV 3.8.3.2", factors: childFactors, reasons: [{ code: "bp_under3" }] });
  }
  return items;
}

// -- household ------------------------------------------------------------------

export function evaluateHousehold(hh, rules, refDate) {
  const ref = d(refDate);
  const members = hh.members.map((p) => {
    const items = p.kind === "adult" ? evaluateAdult(p, hh, ref, rules) : evaluateChild(p, ref, rules);
    const used = new Set(["demographics", "screening_history"]);
    items.forEach((i) => (i.factors || []).forEach((f) => used.add(f.category)));
    items.forEach((i) => (i.dataUsed = [...new Set(["demographics", "screening_history", ...(i.factors || []).map((f) => f.category)])]));
    return { person: p, items, dataUsed: [...used] };
  });
  const actions = members
    .flatMap((m) => m.items.filter((i) => i.tier && i.tier <= 4).map((i) => ({ ...i, personName: m.person.display_name || m.person.role })))
    .sort((a, b) => a.tier - b.tier || (b.priority || 0) - (a.priority || 0));
  return { household: hh.id, refDate, members, actions };
}

// Plain-English rendering of reason codes (the app translates the same codes).
export function reasonText(r) {
  switch (r.code) {
    case "never_screened": return "No record of this screening yet.";
    case "due_since": return `Due since ${r.date}.`;
    case "due_on": return `Due on ${r.date}.`;
    case "next_due": return `Next due ${r.date}.`;
    case "elevated_risk": return "Higher priority because of the factors below.";
    case "declined": return `You chose to postpone on ${r.date}. No reminders until ${r.until}.`;
    case "insufficient_result": return `The result from ${r.date} could not be read, so the program recalls you.`;
    case "abnormal_no_referral": return `Result from ${r.date} needs follow-up with ${r.specialist}; a referral is expected within ${r.limit}.`;
    case "referral_not_completed": return `Referral to ${r.specialist} made on ${r.date} has no recorded visit yet.`;
    case "not_thiqa": return `IFHAS covers Thiqa members. Your plan (${r.insurance}) sets your preventive benefits.`;
    case "insufficient_data": return `Not enough data to decide (missing: ${r.missing}). Ask your doctor.`;
    case "preconception": return "Planning a pregnancy? You can ask for a preconception visit.";
    case "genomic_review": return `${r.finding}: what this means for your screening is decided with your doctor.`;
    case "missed_visits": return `Missed visit(s) at ${r.months.join(", ")} months. Catch-up visits are covered.`;
    case "visit_due": return `This visit is due now, until ${r.until}.`;
    case "newborn_hearing": return "The newborn hearing test was not completed; it should be done as soon as possible.";
    case "bp_under3": return "Because of a risk condition, blood pressure should be checked at visits before age 3.";
    case "done_once": return `Done on ${r.date}; needed only once.`;
    default: return r.code;
  }
}
