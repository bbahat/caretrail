import test from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { CareTrail } from "../server/app.mjs";

// The simulation date follows the real date. The demo stories must hold for
// every day reviewers might open the app, up to the GITEX finals.
for (const simDate of ["2026-11-20", "2026-12-11"]) {
  test(`demo stories hold on ${simDate}`, () => {
    const path = `/tmp/caretrail-date-${simDate}-${process.pid}.db`;
    const ct = new CareTrail({ dbPath: path, simDate });
    try {
      const item = (pid, key) => ct.hh(pid.slice(0, 6)).eval.members.find((m) => m.person.id === pid).items.find((i) => i.key === key);
      assert.equal(ct.ref, simDate);
      assert.equal(item("DEMO-1-02", "major").status, "open_loop");
      assert.equal(item("DEMO-2-03", "mchat_18").status, "open_loop");
      assert.ok(item("DEMO-3-03", "hearing_infant"));
      assert.ok(ct.hh("DEMO-1").suggestions.some((s) => s.id === "sug-DEMO-1-02-lipid_review"));
      assert.ok(ct.hh("DEMO-1").suggestions.some((s) => s.id === "sug-DEMO-1-03-bp_review"));
      assert.ok(ct.hh("DEMO-1").signals["DEMO-1-01"]?.some((x) => x.lab === "hba1c"));
      const mariam = ct.verifyToken(ct.token("family-DEMO-1").token);
      const slots = ct.slots(mariam, "screening");
      assert.ok(slots.length > 0 && slots[0].start.slice(0, 10) > simDate);
      assert.ok(ct.familyView(mariam).actions.length >= 3);
    } finally {
      ct.close();
      for (const s of ["", "-wal", "-shm"]) rmSync(path + s, { force: true });
    }
  });
}
