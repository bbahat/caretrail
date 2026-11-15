import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateHousehold } from "../src/engine.js";

const rules = JSON.parse(readFileSync(new URL("../data/rules.json", import.meta.url)));
const demo = JSON.parse(readFileSync(new URL("../data/demo_families.json", import.meta.url)));
const REF = demo.meta.reference_date;
const run = (id) => evaluateHousehold(demo.households.find((h) => h.id === id), rules, REF);
const item = (r, personId, key) => r.members.flatMap((m) => m.items).find((i) => i.personId === personId && i.key === key);

test("abnormal adult result without referral after 15 working days is an open loop", () => {
  const i = item(run("DEMO-1"), "DEMO-1-02", "major");
  assert.equal(i.status, "open_loop");
  assert.equal(i.tier, 1);
  assert.equal(i.decision, "clinical");
});

test("genomic factor appears only with genomic consent", () => {
  const hh = structuredClone(demo.households.find((h) => h.id === "DEMO-1"));
  const khalid = hh.members.find((m) => m.id === "DEMO-1-02");
  const withConsent = evaluateHousehold(hh, rules, REF);
  assert.ok(item(withConsent, "DEMO-1-02", "major").factors.some((f) => f.code === "gen_fh"));
  khalid.consent.genomic = false;
  const without = evaluateHousehold(hh, rules, REF);
  assert.ok(!item(without, "DEMO-1-02", "major").factors.some((f) => f.category === "genomic"));
  assert.ok(!item(without, "DEMO-1-02", "genomic_review"));
});

test("wearable factors are not used without wearable consent", () => {
  const hh = structuredClone(demo.households.find((h) => h.id === "DEMO-1"));
  hh.members.find((m) => m.id === "DEMO-1-01").consent.wearables = false;
  const r = evaluateHousehold(hh, rules, REF);
  assert.ok(!item(r, "DEMO-1-01", "major").factors.some((f) => f.category === "wearable"));
});

test("lung screening applies only to high-risk smokers aged 55-75", () => {
  const r = run("DEMO-1");
  assert.equal(item(r, "DEMO-1-03", "lung_ldct").status, "overdue");
  assert.equal(item(r, "DEMO-1-02", "lung_ldct"), undefined); // 45 years old
});

test("non-Thiqa adults are told IFHAS does not cover them, not given packages", () => {
  const r = run("DEMO-2");
  const ayesha = r.members.find((m) => m.person.id === "DEMO-2-01").items;
  assert.equal(ayesha.length, 1);
  assert.equal(ayesha[0].status, "not_eligible");
});

test("a recent decline is respected: no tier, no reminder", () => {
  const i = item(run("DEMO-3"), "DEMO-3-01", "female_repro");
  assert.equal(i.status, "declined");
  assert.equal(i.tier, null);
});

test("moderate M-CHAT-R with an uncompleted referral after 4 weeks is an open loop", () => {
  const i = item(run("DEMO-2"), "DEMO-2-03", "mchat_18");
  assert.equal(i.status, "open_loop");
  assert.equal(i.reasons[0].limit, "4 weeks");
});

test("the 18-month visit is due and flagged for developmental screening", () => {
  const i = item(run("DEMO-1"), "DEMO-1-04", "wcv_18");
  assert.equal(i.status, "due");
  assert.ok(i.components.some((c) => c.id === "mchat_r"));
  assert.ok(i.components.some((c) => c.id === "idaq"));
});

test("missed newborn hearing test is flagged", () => {
  assert.equal(item(run("DEMO-3"), "DEMO-3-03", "hearing_infant").tier, 2);
});

test("actions are ordered by tier", () => {
  const tiers = run("DEMO-1").actions.map((a) => a.tier);
  assert.deepEqual(tiers, [...tiers].sort((a, b) => a - b));
});
