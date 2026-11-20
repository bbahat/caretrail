import test from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { CareTrail } from "../server/app.mjs";
import { suggestionsFor } from "../server/ai/trends.mjs";

const path = `/tmp/caretrail-test-${process.pid}.db`;
const ct = new CareTrail({ dbPath: path });
const as = (id) => ct.verifyToken(ct.token(id).token);
test.after(() => { ct.close(); for (const s of ["", "-wal", "-shm"]) rmSync(path + s, { force: true }); });

test("trend suggestions only ever bring a check forward", () => {
  let n = 0;
  for (const { id } of ct.households) {
    for (const p of ct.hh(id).record.members) {
      for (const s of suggestionsFor(p, ct.ref)) {
        n++;
        if (s.standard_next_due) assert.ok(s.proposed_date < s.standard_next_due, s.id);
        assert.ok(s.proposed_date > ct.ref, s.id);
      }
    }
  }
  assert.ok(n > 0);
});

test("families cannot act on another household", () => {
  const mariam = as("family-DEMO-1");
  assert.throws(() => ct.setConsent(mariam, "DEMO-2-01", "genomic", true), /household/);
  assert.throws(() => ct.decline(mariam, "H00000-01", "major"), /household/);
});

test("a suggestion reaches the family only after a clinician approves it", () => {
  const mariam = as("family-DEMO-1");
  const has = () => ct.familyView(mariam).actions.some((a) => a.status === "doctor_recommended");
  assert.equal(has(), false);
  ct.decideSuggestion(as("clinician"), { id: "sug-DEMO-1-02-lipid_review", decision: "approve" });
  assert.equal(has(), true);
});

test("switching off genomic consent removes the genomic factor and the lipid suggestion", () => {
  const mariam = as("family-DEMO-1");
  const khalidMajor = () => ct.familyView(mariam).members.find((m) => m.id === "DEMO-1-02").items.find((i) => i.key === "major");
  assert.ok(khalidMajor().factors.some((f) => f.code === "gen_fh"));
  ct.setConsent(mariam, "DEMO-1-02", "genomic", false);
  assert.ok(!khalidMajor().factors.some((f) => f.code === "gen_fh"));
  assert.ok(!ct.hh("DEMO-1").suggestions.some((s) => s.reason === "genomic_fh_rising"));
  ct.setConsent(mariam, "DEMO-1-02", "genomic", true);
});

test("a clinician referral turns an open loop into a pending referral", () => {
  const loop = () => ct.hh("DEMO-1").eval.members.find((m) => m.person.id === "DEMO-1-02").items.find((i) => i.key === "major");
  assert.equal(loop().status, "open_loop");
  ct.referral(as("clinician"), { patient: "DEMO-1-02", key: "major", decision: "refer", specialist: "Internal medicine" });
  assert.equal(loop().status, "referral_pending");
  ct.referral(as("clinician"), { patient: "DEMO-1-02", key: "major", decision: "complete" });
  assert.notEqual(loop().status, "open_loop");
});

test("booking takes the slot; a second booking of the same slot is refused", () => {
  const mariam = as("family-DEMO-1");
  const [slot] = ct.slots(mariam, "screening");
  ct.book(mariam, { slotId: slot.id, patient: "DEMO-1-01", itemId: "DEMO-1-01:major", title: "Major package" });
  assert.throws(() => ct.book(mariam, { slotId: slot.id, patient: "DEMO-1-03", itemId: "DEMO-1-03:dexa", title: "DEXA" }), /no longer free/);
  assert.ok(ct.familyView(mariam).actions.find((a) => a.id === "DEMO-1-01:major").booked);
});

test("aggregates suppress groups under 10 people", () => {
  const o = ct.overview();
  for (const p of o.packages) if (p.eligible < 10) assert.equal(p.participation_pct, null);
  for (const s of o.safeguards) if (s.suppressed) assert.equal(s.n, undefined);
});

test("opening a pseudonymous record needs a purpose and lands in that family's log", () => {
  const prog = as("program");
  const row = ct.queue().rows[0];
  assert.throws(() => ct.openRecord(prog, row.pseudonym, "curiosity"), /purpose/);
  const r = ct.openRecord(prog, row.pseudonym, "purpose_outreach");
  const e = ct.ledger.entries[r.ledgerIndex];
  assert.equal(e.pseudonym, row.pseudonym);
  assert.equal(ct.ledger.selfCheck(), true);
});

test("adaptive outreach learns: after several weeks it beats SMS-for-everyone", () => {
  const prog = as("program");
  let last;
  for (let w = 0; w < 6; w++) last = ct.runOutreachWeek(prog).summary;
  const hist = ct.banditView().history;
  const ct3 = hist.slice(-3).reduce((s, h) => s + h.rate, 0), base3 = hist.slice(-3).reduce((s, h) => s + h.baseline_rate, 0);
  assert.ok(ct3 > base3, `${ct3} vs ${base3}`);
  assert.ok(last.contacted > 0);
});

test("visitor reset puts the demo families back to their starting state", () => {
  const mariam = as("family-DEMO-1");
  const [slot] = ct.slots(mariam, "screening");
  ct.setConsent(mariam, "DEMO-1-01", "wearables", false);
  ct.book(mariam, { slotId: slot.id, patient: "DEMO-1-03", itemId: "DEMO-1-03:dexa", title: "DEXA" });
  ct.resetDemo("test");
  const v = ct.familyView(mariam);
  assert.equal(v.members[0].consent.wearables, true);
  assert.equal(v.appointments.length, 0);
  assert.equal(ct.store.get("Slot", slot.id).status, "free");
  assert.ok(ct.hh("DEMO-1").suggestions.every((s) => s.status === "pending"));
  assert.equal(ct.familyView(mariam).members.find((m) => m.id === "DEMO-1-02").items.find((i) => i.key === "major").status, "open_loop");
});

test("family export is a FHIR Bundle that respects consent", () => {
  const mariam = as("family-DEMO-1");
  ct.setConsent(mariam, "DEMO-1-02", "genomic", false);
  const b = ct.exportFamily(mariam);
  assert.equal(b.resourceType, "Bundle");
  assert.ok(b.entry.some((e) => e.resource.resourceType === "Patient"));
  assert.ok(!b.entry.some((e) => e.resource.id?.startsWith("gen-DEMO-1-02")));
  ct.setConsent(mariam, "DEMO-1-02", "genomic", true);
});
