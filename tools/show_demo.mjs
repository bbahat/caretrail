import { readFileSync } from "node:fs";
import { evaluateHousehold, reasonText, TIERS } from "../src/engine.js";
const rules = JSON.parse(readFileSync("data/rules.json", "utf8"));
const demo = JSON.parse(readFileSync("data/demo_families.json", "utf8"));
for (const hh of demo.households) {
  const r = evaluateHousehold(hh, rules, demo.meta.reference_date);
  console.log(`\n=== ${hh.label} (${hh.insurance}, ${hh.region}) ===`);
  for (const a of r.actions) {
    console.log(`[T${a.tier} ${TIERS[a.tier]}] ${a.personName}: ${a.title} — ${a.reasons.map(reasonText).join(" ")}`);
    if (a.factors?.length) console.log(`      factors: ${a.factors.map(f => f.text).join("; ")}`);
  }
  const other = r.members.flatMap(m => m.items.filter(i => !i.tier || i.tier > 4).map(i => `${m.person.display_name}: ${i.title} [${i.status}]`));
  console.log("   other:", other.join(" | "));
}
