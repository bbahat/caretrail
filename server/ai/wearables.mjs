// Wearable change detection on consented telemetry (weekly means).
// Compares the last 4 weeks with the 8 weeks before. A sustained drop in
// activity or rise in resting heart rate produces a wellbeing nudge for the
// person and a signal for outreach. It is never presented as a diagnosis.

import { round } from "../util.mjs";

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

export function wearableChange(series) {
  if (!series?.steps?.length || series.steps.length < 12) return null;
  const split = (k) => [mean(series[k].slice(0, 8)), mean(series[k].slice(8))];
  const [s0, s1] = split("steps"), [h0, h1] = split("rhr"), [z0, z1] = split("sleep");
  const out = [];
  const stepsPct = (s1 - s0) / s0;
  if (stepsPct <= -0.25) out.push({ kind: "activity_drop", before: Math.round(s0), after: Math.round(s1), pct: round(stepsPct * 100, 0) });
  if (h1 - h0 >= 5) out.push({ kind: "rhr_rise", before: Math.round(h0), after: Math.round(h1), delta: round(h1 - h0, 0) });
  if (z0 - z1 >= 0.5) out.push({ kind: "sleep_drop", before: round(z0, 1), after: round(z1, 1), delta: round(z1 - z0, 1) });
  return out.length ? out : null;
}
