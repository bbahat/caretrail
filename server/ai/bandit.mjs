// Adaptive outreach: Thompson sampling over channel x message framing,
// learned separately for each context (language group x age group).
// Every week of outreach updates the posteriors, so the program learns which
// invitation works for whom instead of sending the same SMS to everyone.
//
// The response rates the simulator draws from are hidden from the bandit and
// are illustrative assumptions, not measurements.

import { rng } from "../util.mjs";

export const CHANNELS = ["app", "sms", "whatsapp", "call"];
export const FRAMINGS = ["personal", "family"];
export const ARMS = CHANNELS.flatMap((c) => FRAMINGS.map((f) => `${c}:${f}`));
export const BASELINE_ARM = "sms:personal";

export function contextOf(p, hh, ref = "2026-11-15") {
  const lang = hh.preferred_language === "ar" ? "arabic" : hh.preferred_language === "en" ? "english" : "other";
  if (p.kind === "child") return `${lang}|guardian`;
  const age = (new Date(ref) - new Date(p.birth_date)) / (365.25 * 864e5);
  return `${lang}|${age >= 45 ? "45-75" : "18-44"}`;
}
export const CONTEXTS = ["arabic", "english", "other"].flatMap((l) => ["18-44", "45-75", "guardian"].map((a) => `${l}|${a}`));

// Hidden simulation truth (probability of booking within 14 days).
const BASE = {
  arabic: { app: 0.34, sms: 0.22, whatsapp: 0.28, call: 0.3 },
  english: { app: 0.3, sms: 0.2, whatsapp: 0.33, call: 0.24 },
  other: { app: 0.1, sms: 0.13, whatsapp: 0.35, call: 0.31 },
};
export function trueRate(ctx, arm, pComplete = 0.55) {
  const [lang, age] = ctx.split("|");
  const [ch, fr] = arm.split(":");
  let r = BASE[lang][ch];
  if (age === "45-75") r += ch === "call" ? 0.08 : ch === "app" ? -0.07 : 0;
  if (age === "18-44" && ch === "app") r += 0.04;
  if (fr === "family") r += age === "guardian" ? 0.08 : 0.01;
  r *= Math.min(1.5, Math.max(0.5, pComplete / 0.55));
  return Math.min(0.95, Math.max(0.01, r));
}

export function newState() {
  return { week: 0, posterior: Object.fromEntries(CONTEXTS.map((c) => [c, Object.fromEntries(ARMS.map((a) => [a, [1, 1]]))])), history: [] };
}

export function choose(state, ctx, r) {
  let best = null, bestDraw = -1;
  for (const a of ARMS) {
    const [al, be] = state.posterior[ctx][a];
    const draw = r.beta(al, be);
    if (draw > bestDraw) { bestDraw = draw; best = a; }
  }
  return best;
}

export function bestArm(state, ctx) {
  return ARMS.map((a) => { const [al, be] = state.posterior[ctx][a]; return [a, al / (al + be), al + be - 2]; }).sort((x, y) => y[1] - x[1])[0];
}

// people: [{ctx, pComplete}] -> runs one week, updates state, returns summary.
export function runWeek(state, people, seed) {
  const r = rng(seed);
  const rb = rng(seed + 999);
  let hits = 0, baseHits = 0;
  const perArm = {};
  for (const person of people) {
    const arm = choose(state, person.ctx, r);
    const ok = r() < trueRate(person.ctx, arm, person.pComplete);
    const okBase = rb() < trueRate(person.ctx, BASELINE_ARM, person.pComplete);
    const post = state.posterior[person.ctx][arm];
    ok ? post[0]++ : post[1]++;
    hits += ok;
    baseHits += okBase;
    perArm[arm] = (perArm[arm] || 0) + 1;
    person.result = { arm, ok };
  }
  state.week++;
  const summary = { week: state.week, contacted: people.length, responded: hits, rate: +(hits / people.length).toFixed(3), baseline_rate: +(baseHits / people.length).toFixed(3), perArm };
  state.history.push(summary);
  return summary;
}
