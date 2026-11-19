import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Ledger } from "../server/ledger.mjs";
import { verifyLog } from "../web/verify.js";

function fakeStore() {
  const db = new DatabaseSync(":memory:");
  const kv = new Map();
  return { db, kv: (k, v) => (v === undefined ? kv.get(k) : (kv.set(k, v), v)) };
}

test("browser verifier accepts server proofs for every log size 1..24, with consistency", async () => {
  const l = new Ledger(fakeStore());
  let first = null;
  for (let n = 1; n <= 24; n++) {
    l.append({ hh: n % 3 === 0 ? "A" : "B", n });
    if (n === 5) first = { size: 5, root: l.checkpoint().root };
    const data = l.proofs((e) => e.hh === "A" || n < 3, { from: first?.size });
    const r = await verifyLog(JSON.parse(JSON.stringify(data)), first);
    assert.equal(r.ok, true, `size ${n}`);
    assert.equal(r.signature, true);
    if (first && n >= 5) assert.equal(r.consistent, true);
  }
});

test("an edited entry fails verification in the browser", async () => {
  const l = new Ledger(fakeStore());
  for (let n = 0; n < 9; n++) l.append({ hh: "A", purpose: "purpose_outreach", n });
  const data = JSON.parse(JSON.stringify(l.proofs(() => true)));
  data.entries[4].entry.purpose = "purpose_quality";
  const r = await verifyLog(data, null);
  assert.equal(r.ok, false);
  assert.equal(r.badIndex, 4);
});

test("a forged checkpoint signature is rejected", async () => {
  const l = new Ledger(fakeStore());
  l.append({ a: 1 });
  const data = JSON.parse(JSON.stringify(l.proofs(() => true)));
  data.checkpoint.signature = data.checkpoint.signature.replace(/^../, "00");
  assert.equal((await verifyLog(data, null)).signature, false);
});
