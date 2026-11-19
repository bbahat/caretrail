// Server-side data-use ledger: append-only Merkle log (RFC 6962 / RFC 9162
// hashing) persisted in SQLite, with an Ed25519-signed checkpoint after every
// append. Clients get inclusion and consistency proofs and verify them in the
// browser with WebCrypto, so they do not have to trust the server's word.

import { createHash, generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

const sha = (...parts) => { const h = createHash("sha256"); for (const p of parts) h.update(p); return h.digest(); };
export const leafHash = (bytes) => sha(Buffer.from([0]), bytes);
const nodeHash = (l, r) => sha(Buffer.from([1]), l, r);
const split = (n) => { let k = 1; while (k << 1 < n) k <<= 1; return k; };

export function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

export function mth(leaves, lo = 0, hi = leaves.length, memo = new Map()) {
  const n = hi - lo;
  if (n === 0) return sha();
  if (n === 1) return leaves[lo];
  const key = lo * 1e7 + hi;
  if (memo.has(key)) return memo.get(key);
  const k = split(n);
  const h = nodeHash(mth(leaves, lo, lo + k, memo), mth(leaves, lo + k, hi, memo));
  memo.set(key, h);
  return h;
}
export function inclusionPath(m, leaves, lo = 0, hi = leaves.length, memo = new Map()) {
  const n = hi - lo;
  if (n <= 1) return [];
  const k = split(n);
  if (m < k) return [...inclusionPath(m, leaves, lo, lo + k, memo), mth(leaves, lo + k, hi, memo)];
  return [...inclusionPath(m - k, leaves, lo + k, hi, memo), mth(leaves, lo, lo + k, memo)];
}
export function consistencyProof(m, leaves, lo = 0, hi = leaves.length, b = true, memo = new Map()) {
  const n = hi - lo;
  if (m === n) return b ? [] : [mth(leaves, lo, hi, memo)];
  const k = split(n);
  if (m <= k) return [...consistencyProof(m, leaves, lo, lo + k, b, memo), mth(leaves, lo + k, hi, memo)];
  return [...consistencyProof(m - k, leaves, lo + k, hi, false, memo), mth(leaves, lo, lo + k, memo)];
}

export class Ledger {
  constructor(store, origin = "caretrail/data-use-log") {
    this.store = store;
    this.origin = origin;
    store.db.exec("CREATE TABLE IF NOT EXISTS ledger (i INTEGER PRIMARY KEY, json TEXT NOT NULL, leaf BLOB NOT NULL)");
    let pem = process.env.LEDGER_KEY || store.kv("ledger_private_key");
    if (!pem) {
      const { privateKey } = generateKeyPairSync("ed25519");
      pem = privateKey.export({ type: "pkcs8", format: "pem" });
      store.kv("ledger_private_key", pem);
    }
    this.priv = createPrivateKey(pem);
    this.pub = createPublicKey(this.priv);
    this.pubRaw = this.pub.export({ format: "der", type: "spki" }).subarray(-32);
    this.entries = [];
    this.leaves = [];
    for (const row of store.db.prepare("SELECT json, leaf FROM ledger ORDER BY i").all()) {
      this.entries.push(JSON.parse(row.json));
      this.leaves.push(Buffer.from(row.leaf));
    }
    this.ins = store.db.prepare("INSERT INTO ledger (i, json, leaf) VALUES (?, ?, ?)");
    this.#checkpoint();
  }

  append(entry) {
    const e = { ...entry, i: this.entries.length };
    const leaf = leafHash(Buffer.from(canonical(e)));
    this.ins.run(e.i, JSON.stringify(e), leaf);
    this.entries.push(e);
    this.leaves.push(leaf);
    this.#checkpoint();
    return e;
  }

  #note(size, root) { return Buffer.from(`${this.origin}\n${size}\n${root.toString("base64")}\n`); }
  #checkpoint() {
    const size = this.leaves.length;
    const root = mth(this.leaves);
    this.cp = { origin: this.origin, size, root: root.toString("hex"), signature: sign(null, this.#note(size, root), this.priv).toString("hex"), alg: "Ed25519", publicKey: this.pubRaw.toString("hex") };
  }
  checkpoint() { return this.cp; }

  proofs(filter, { from } = {}) {
    const memo = new Map();
    const entries = this.entries.filter(filter).map((e) => ({ entry: e, leaf: this.leaves[e.i].toString("hex"), path: inclusionPath(e.i, this.leaves, 0, this.leaves.length, memo).map((h) => h.toString("hex")) }));
    const out = { checkpoint: this.cp, entries };
    if (from && from > 0 && from <= this.leaves.length) {
      out.consistency = { from, fromRoot: mth(this.leaves.slice(0, from)).toString("hex"), proof: consistencyProof(from, this.leaves).map((h) => h.toString("hex")) };
    }
    return out;
  }

  selfCheck() {
    return verify(null, this.#note(this.cp.size, Buffer.from(this.cp.root, "hex")), this.pub, Buffer.from(this.cp.signature, "hex"));
  }
}
