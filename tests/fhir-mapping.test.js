import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { evaluateHousehold } from "../src/engine.js";
import { toFhir, fromFhir } from "../server/fhir/mapping.mjs";

const RULES = JSON.parse(readFileSync(new URL("../data/rules.json", import.meta.url)));
const DEMO = JSON.parse(readFileSync(new URL("../data/demo_families.json", import.meta.url)));
const REF = "2026-11-15";
const strip = (res) => res.members.map((m) => m.items.map((i) => ({ id: i.id, status: i.status, tier: i.tier, reasons: i.reasons, factors: (i.factors || []).map((f) => f.code) })));
const roundTrip = (hh) => {
  const res = toFhir(hh);
  const group = res.find((r) => r.resourceType === "Group");
  return fromFhir(group, res);
};

test("FHIR round trip gives identical engine output for the demo families", () => {
  for (const hh of DEMO.households) {
    assert.deepEqual(strip(evaluateHousehold(roundTrip(hh), RULES, REF)), strip(evaluateHousehold(hh, RULES, REF)), hh.id);
  }
});

test("FHIR round trip gives identical engine output for the synthetic population", { skip: !existsSync(new URL("../data/population.json", import.meta.url)) }, () => {
  const POP = JSON.parse(readFileSync(new URL("../data/population.json", import.meta.url)));
  let n = 0;
  for (const hh of POP.households) {
    assert.deepEqual(strip(evaluateHousehold(roundTrip(hh), RULES, REF)), strip(evaluateHousehold(hh, RULES, REF)), hh.id);
    n++;
  }
  assert.equal(n, POP.households.length);
});

test("consent is enforced at the data layer", () => {
  const hh = structuredClone(DEMO.households[0]);
  const res = toFhir(hh);
  const group = res.find((r) => r.resourceType === "Group");
  const khalid = fromFhir(group, res).members.find((m) => m.display_name === "Khalid");
  assert.ok(khalid.genomic_findings.length > 0);
  const c = res.find((r) => r.id === `consent-${khalid.id}-genomic`);
  c.provision.type = "deny";
  const after = fromFhir(group, res).members.find((m) => m.display_name === "Khalid");
  assert.deepEqual(after.genomic_findings, []);
  const mariam = res.find((r) => r.id === "consent-DEMO-1-01-wearables");
  mariam.provision.type = "deny";
  assert.equal(fromFhir(group, res).members[0].wearable, null);
});
