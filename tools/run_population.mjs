// Run the guideline engine over the whole synthetic population and write one
// flat row per person for analytics (model training, KPIs, safeguards).
import { readFileSync, writeFileSync } from "node:fs";
import { evaluateHousehold } from "../src/engine.js";

const rules = JSON.parse(readFileSync("data/rules.json", "utf8"));
const pop = JSON.parse(readFileSync("data/population.json", "utf8"));
const REF = pop.meta.reference_date;
const ref = new Date(REF + "T00:00:00Z");
const ageY = (b) => (ref - new Date(b + "T00:00:00Z")) / 86400000 / 365.25;

const rows = [];
for (const hh of pop.households) {
  const r = evaluateHousehold(hh, rules, REF);
  const nYoung = hh.members.filter((m) => m.kind === "child").length;
  for (const m of r.members) {
    const p = m.person;
    const actionable = m.items.filter((i) => i.tier && i.tier <= 4);
    rows.push({
      id: p.id, household: hh.id, kind: p.kind, sex: p.sex, age: +ageY(p.birth_date).toFixed(2),
      national: hh.national, insurance: hh.insurance, region: hh.region, language: hh.preferred_language,
      channel: p.preferred_channel || hh.preferred_channel, employment: p.employment || null,
      n_young_children: nYoung, n_conditions: (p.conditions || []).length,
      invites_3y: p.engagement.invites_3y, responded_3y: p.engagement.responded_3y,
      declined_12m: p.engagement.declined_12m, no_show_3y: p.engagement.no_show_3y,
      best_tier: actionable.length ? Math.min(...actionable.map((i) => i.tier)) : null,
      n_open_loops: m.items.filter((i) => i.status === "open_loop").length,
      n_overdue: m.items.filter((i) => i.status === "overdue").length,
      n_due: m.items.filter((i) => i.status === "due").length,
      items: m.items.map((i) => ({ key: i.key, status: i.status, tier: i.tier, program: i.program })),
      p_true: p._p_complete_90d, completed_90d: p._outcome_completes_90d,
    });
  }
}
writeFileSync("data/engine_population.json", JSON.stringify({ meta: pop.meta, rows }));
const withGaps = rows.filter((r) => r.best_tier);
console.log(`people=${rows.length} with actionable gaps=${withGaps.length} open-loop people=${rows.filter((r) => r.n_open_loops).length}`);
console.log("by best tier:", [1, 2, 3, 4].map((t) => `T${t}=${withGaps.filter((r) => r.best_tier === t).length}`).join(" "));
