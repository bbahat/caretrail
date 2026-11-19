// Proactive lapse model: the probability that a person will NOT complete a
// due screening within 90 days. It combines engagement history, household
// context, chronic conditions, family history, longitudinal lab trends and
// consented wearable change. L2-regularised logistic regression trained in
// the server, so it retrains as new outreach outcomes arrive.
//
// Used only to order outreach within the same clinical tier. It is never
// shown to families and never used for eligibility or insurance decisions.

const FEATURES = [
  ["age_18_29", "Aged 18-29"], ["age_60_75", "Aged 60-75"], ["child", "Child (Well-Child programme)"],
  ["male", "Male"], ["national", "UAE national"], ["thiqa", "Thiqa member"],
  ["al_ain", "Lives in Al Ain"], ["al_dhafra", "Lives in Al Dhafra"],
  ["lang_other", "Preferred language not Arabic or English"],
  ["ch_sms", "Prefers SMS"], ["ch_whatsapp", "Prefers WhatsApp"], ["ch_call", "Prefers phone calls"],
  ["response_rate", "Past invitation response rate"], ["declines_12m", "Declines in the past 12 months"],
  ["no_shows_3y", "Missed appointments in 3 years"], ["chronic", "Has a chronic condition"],
  ["fh_count", "Family history items"], ["young_children", "Number of young children in household"],
  ["rising_trend", "Lab trend heading toward a threshold"], ["wearable_change", "Recent drop in activity (wearable)"],
];
export const FEATURE_LABELS = Object.fromEntries(FEATURES);

export function features(p, hh, ops, extra = {}) {
  const age = (new Date(extra.ref || "2026-11-15") - new Date(p.birth_date)) / (365.25 * 864e5);
  const e = ops?.engagement || {};
  const kids = hh.members.filter((m) => m.kind === "child").length;
  return {
    age_18_29: p.kind === "adult" && age < 30 ? 1 : 0,
    age_60_75: p.kind === "adult" && age >= 60 ? 1 : 0,
    child: p.kind === "child" ? 1 : 0,
    male: p.sex === "male" ? 1 : 0,
    national: hh.national ? 1 : 0,
    thiqa: hh.insurance === "Thiqa" ? 1 : 0,
    al_ain: hh.region === "Al Ain" ? 1 : 0,
    al_dhafra: hh.region === "Al Dhafra" ? 1 : 0,
    lang_other: ["ar", "en"].includes(hh.preferred_language) ? 0 : 1,
    ch_sms: hh.preferred_channel === "sms" ? 1 : 0,
    ch_whatsapp: hh.preferred_channel === "whatsapp" ? 1 : 0,
    ch_call: hh.preferred_channel === "call" ? 1 : 0,
    response_rate: e.invites_3y ? e.responded_3y / e.invites_3y : 0.5,
    declines_12m: e.declined_12m || 0,
    no_shows_3y: e.no_show_3y || 0,
    chronic: (p.conditions || []).length ? 1 : 0,
    fh_count: (p.family_history || []).length,
    young_children: kids,
    rising_trend: extra.trend ? 1 : 0,
    wearable_change: extra.wearable ? 1 : 0,
  };
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

export function train(rows, { l2 = 0.01, iters = 400, lr = 0.5, seed = 7 } = {}) {
  // rows: [{x: {feature: value}, y: 0|1}]
  const names = FEATURES.map(([k]) => k);
  const X = rows.map((r) => names.map((k) => r.x[k] ?? 0));
  const mu = names.map((_, j) => X.reduce((s, x) => s + x[j], 0) / X.length);
  const sd = names.map((_, j) => Math.sqrt(X.reduce((s, x) => s + (x[j] - mu[j]) ** 2, 0) / X.length) || 1);
  const Z = X.map((x) => x.map((v, j) => (v - mu[j]) / sd[j]));
  const y = rows.map((r) => r.y);
  let w = names.map(() => 0), b = 0;
  const n = Z.length;
  for (let it = 0; it < iters; it++) {
    const gw = names.map(() => 0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const p = sigmoid(b + Z[i].reduce((s, z, j) => s + z * w[j], 0));
      const err = p - y[i];
      gb += err;
      for (let j = 0; j < w.length; j++) gw[j] += err * Z[i][j];
    }
    b -= (lr * gb) / n;
    w = w.map((wj, j) => wj - lr * (gw[j] / n + l2 * wj));
  }
  return { names, mu, sd, w, b, seed };
}

export function predict(model, x) {
  const z = model.names.reduce((s, k, j) => s + (((x[k] ?? 0) - model.mu[j]) / model.sd[j]) * model.w[j], model.b);
  return sigmoid(z);
}

// Contribution of each feature to this person's score, for "main factors".
export function drivers(model, x, k = 3) {
  return model.names
    .map((name, j) => ({ name, label: FEATURE_LABELS[name], value: (((x[name] ?? 0) - model.mu[j]) / model.sd[j]) * model.w[j] }))
    .filter((d) => d.value > 0.05)
    .sort((a, b) => b.value - a.value)
    .slice(0, k);
}

export function auc(scores, labels) {
  const pairs = scores.map((s, i) => [s, labels[i]]).sort((a, b) => a[0] - b[0]);
  let rank = 0, sumPos = 0, nPos = 0;
  for (let i = 0; i < pairs.length; ) {
    let j = i;
    while (j < pairs.length && pairs[j][0] === pairs[i][0]) j++;
    const avg = (i + j + 1) / 2;
    for (let k = i; k < j; k++) if (pairs[k][1]) { sumPos += avg; nPos++; }
    rank = j;
    i = j;
  }
  const nNeg = pairs.length - nPos;
  return nPos && nNeg ? (sumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg) : null;
}

export function evaluate(model, rows, bins = 8) {
  const s = rows.map((r) => predict(model, r.x));
  const y = rows.map((r) => r.y);
  const brier = s.reduce((a, p, i) => a + (p - y[i]) ** 2, 0) / s.length;
  const edges = Array.from({ length: bins + 1 }, (_, i) => i / bins);
  const cal = [];
  let ece = 0;
  for (let b = 0; b < bins; b++) {
    const idx = s.map((p, i) => [p, i]).filter(([p]) => p >= edges[b] && (b === bins - 1 ? p <= 1 : p < edges[b + 1]));
    if (!idx.length) continue;
    const mp = idx.reduce((a, [p]) => a + p, 0) / idx.length;
    const ob = idx.reduce((a, [, i]) => a + y[i], 0) / idx.length;
    ece += (idx.length / s.length) * Math.abs(mp - ob);
    cal.push({ mean_predicted: +mp.toFixed(3), observed: idx.length >= 10 ? +ob.toFixed(3) : null, n: idx.length });
  }
  return { auc: +auc(s, y).toFixed(3), brier: +brier.toFixed(3), ece: +ece.toFixed(3), calibration: cal };
}
