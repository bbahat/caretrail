import test from "node:test";
import assert from "node:assert/strict";
import { Ledger } from "../app/ledger.js";

test("every entry verifies for log sizes 1..20, and the log is consistent with its first checkpoint", async () => {
  for (let n = 1; n <= 20; n++) {
    const l = new Ledger();
    await l.appendMany([{ action: "seed", n: 0 }]);
    for (let i = 1; i < n; i++) await l.append({ action: "x", n: i });
    const r = await l.verify();
    assert.equal(r.ok, true, `size ${n}`);
    assert.equal(r.checked, n);
    assert.equal(r.consistent, true);
    assert.equal(r.signature, true);
  }
});

test("an edited entry is detected", async () => {
  const l = new Ledger();
  await l.appendMany([{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 }]);
  await l.append({ a: 6 });
  l.entries[3] = { ...l.entries[3], a: 99 };
  const r = await l.verify();
  assert.equal(r.ok, false);
  assert.equal(r.badIndex, 3);
});

test("filtered verification checks only the household's entries", async () => {
  const l = new Ledger();
  await l.appendMany([{ hh: "A" }, { hh: "B" }, { hh: "A" }]);
  const r = await l.verify((e) => e.hh === "A");
  assert.equal(r.ok, true);
  assert.equal(r.checked, 2);
});
