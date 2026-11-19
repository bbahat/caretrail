// Longitudinal trend engine.
//
// Reads a person's lab and vital-sign history (FHIR Observations), fits a
// per-person linear trend, projects 12 months ahead and proposes an EARLIER
// recheck when the trajectory is heading toward a clinical threshold.
// Proposals are never later than the standard schedule and are never shown to
// the family until a clinician approves them.

import { addDays, yearsBetween, round } from "../util.mjs";

// Thresholds are standard diagnostic cut-offs (ADA for HbA1c; ESC/ACC office
// blood pressure; LDL >= 190 mg/dL as severe hypercholesterolaemia).
export const THRESHOLDS = {
  hba1c: { prediabetes: 5.7, diabetes: 6.5 },
  sbp: { elevated: 130, hypertension: 140 },
  ldl: { high: 160, severe: 190 },
};

export function fit(series, ref) {
  if (!series || series.length < 3) return null;
  const xs = series.map((p) => yearsBetween(series[0].date, p.date));
  const ys = series.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / sxx;
  const last = series[series.length - 1];
  const yearsSinceLast = yearsBetween(last.date, ref);
  return {
    n: series.length,
    slope_per_year: round(slope, 3),
    last: last.value,
    last_date: last.date,
    projected_12m: round(last.value + slope * (yearsSinceLast + 1), 2),
  };
}

// The standard next check for these labs is the IFHAS major package, every 3 years.
function standardNextDue(p) {
  const last = p.screening?.major?.last_done;
  return last ? addDays(last, Math.round(3 * 365.25)) : null;
}

export function suggestionsFor(p, ref) {
  if (p.kind !== "adult" || !p.labs) return [];
  const out = [];
  const conditions = new Set(p.conditions || []);
  const standard = standardNextDue(p);
  const propose = (kind, lab, tr, months, reason) => {
    let proposed = addDays(ref, Math.round(months * 30.44));
    // Safety rule: a suggestion may only bring a check forward.
    if (standard && proposed >= standard) return;
    if (proposed < addDays(ref, 14)) proposed = addDays(ref, 14);
    out.push({
      id: `sug-${p.id}-${kind}`,
      personId: p.id,
      kind,
      lab,
      trend: tr,
      series: p.labs[lab],
      proposed_date: proposed,
      standard_next_due: standard,
      reason,
      decision: "clinical",
    });
  };
  const hb = fit(p.labs.hba1c, ref);
  if (hb && !conditions.has("diabetes") && !conditions.has("type1_diabetes") && hb.last < THRESHOLDS.hba1c.diabetes) {
    if (hb.projected_12m >= THRESHOLDS.hba1c.diabetes) propose("hba1c_recheck", "hba1c", hb, 6, "projected_cross");
    else if (hb.last >= THRESHOLDS.hba1c.prediabetes && hb.slope_per_year >= 0.15) propose("hba1c_recheck", "hba1c", hb, 12, "rising_in_range");
  }
  const bp = fit(p.labs.sbp, ref);
  if (bp) {
    if (bp.last >= THRESHOLDS.sbp.hypertension && bp.slope_per_year >= 3) propose("bp_review", "sbp", bp, 3, conditions.has("hypertension") ? "above_target_rising" : "projected_cross");
    else if (!conditions.has("hypertension") && bp.last >= THRESHOLDS.sbp.elevated && bp.slope_per_year >= 2) propose("bp_review", "sbp", bp, 6, "rising_in_range");
  }
  const ldl = fit(p.labs.ldl, ref);
  const fhGenomic = (p.genomic_findings || []).includes("Familial hypercholesterolemia");
  if (ldl) {
    if (ldl.last >= THRESHOLDS.ldl.severe || (fhGenomic && ldl.slope_per_year > 0)) propose("lipid_review", "ldl", ldl, 3, fhGenomic ? "genomic_fh_rising" : "severe");
    else if (ldl.last >= THRESHOLDS.ldl.high && ldl.slope_per_year >= 5) propose("lipid_review", "ldl", ldl, 6, "rising_in_range");
  }
  return out;
}

// Trend signals worth showing as a factor on the person's own screening item,
// even when no earlier recheck is proposed (for example when the regular check
// is already overdue). These describe the person's own results, not a diagnosis.
export function trendSignals(p, ref) {
  if (p.kind !== "adult" || !p.labs) return [];
  const out = [];
  const add = (lab, tr) => {
    const s = p.labs[lab];
    out.push({ code: `trend_${lab}`, category: "clinical", lab, from: s[0].value, to: s[s.length - 1].value, from_date: s[0].date, to_date: s[s.length - 1].date, slope_per_year: tr.slope_per_year });
  };
  const hb = fit(p.labs.hba1c, ref);
  if (hb && hb.slope_per_year >= 0.1 && (hb.last >= THRESHOLDS.hba1c.prediabetes || hb.projected_12m >= THRESHOLDS.hba1c.diabetes)) add("hba1c", hb);
  const bp = fit(p.labs.sbp, ref);
  if (bp && bp.slope_per_year >= 2 && bp.last >= THRESHOLDS.sbp.elevated) add("sbp", bp);
  const ldl = fit(p.labs.ldl, ref);
  if (ldl && ldl.slope_per_year >= 3 && ldl.last >= THRESHOLDS.ldl.high) add("ldl", ldl);
  return out;
}
