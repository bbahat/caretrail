// Data-use ledger: an append-only Merkle log in the browser.
//
// Same construction as FedTrail: RFC 6962 / RFC 9162 tree hashing
// (leaf = SHA-256(0x00 || entry), node = SHA-256(0x01 || left || right)),
// inclusion and consistency proofs, and a signed checkpoint over
// (size, root). The signature uses Ed25519 where the browser supports it
// and ECDSA P-256 otherwise; the UI shows which one is in use.

const enc = new TextEncoder();

async function sha256(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { buf.set(p, o); o += p.length; }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}
const leafHash = (bytes) => sha256(Uint8Array.of(0), bytes);
const nodeHash = (l, r) => sha256(Uint8Array.of(1), l, r);

export const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const b64 = (b) => btoa(String.fromCharCode(...b));
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Largest power of two strictly smaller than n (n > 1).
const split = (n) => { let k = 1; while (k << 1 < n) k <<= 1; return k; };

export function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

async function mth(leaves) {
  if (leaves.length === 0) return sha256();
  if (leaves.length === 1) return leaves[0];
  const k = split(leaves.length);
  return nodeHash(await mth(leaves.slice(0, k)), await mth(leaves.slice(k)));
}

async function inclusionPath(m, leaves) {
  const n = leaves.length;
  if (n <= 1) return [];
  const k = split(n);
  if (m < k) return [...(await inclusionPath(m, leaves.slice(0, k))), await mth(leaves.slice(k))];
  return [...(await inclusionPath(m - k, leaves.slice(k))), await mth(leaves.slice(0, k))];
}

// RFC 9162 section 2.1.3.2
async function verifyInclusion(leaf, index, size, path, root) {
  if (index >= size) return false;
  let fn = index, sn = size - 1, r = leaf;
  for (const p of path) {
    if (sn === 0) return false;
    if (fn & 1 || fn === sn) {
      r = await nodeHash(p, r);
      if (!(fn & 1)) while (fn !== 0 && !(fn & 1)) { fn >>= 1; sn >>= 1; }
    } else {
      r = await nodeHash(r, p);
    }
    fn >>= 1; sn >>= 1;
  }
  return sn === 0 && eq(r, root);
}

async function subproof(m, leaves, b) {
  const n = leaves.length;
  if (m === n) return b ? [] : [await mth(leaves)];
  const k = split(n);
  if (m <= k) return [...(await subproof(m, leaves.slice(0, k), b)), await mth(leaves.slice(k))];
  return [...(await subproof(m - k, leaves.slice(k), false)), await mth(leaves.slice(0, k))];
}

// RFC 9162 section 2.1.4.2
async function verifyConsistency(m, n, proof, oldRoot, newRoot) {
  if (m === n) return proof.length === 0 && eq(oldRoot, newRoot);
  if (m === 0) return true;
  let path = [...proof];
  if ((m & (m - 1)) === 0) path = [oldRoot, ...path];
  let fn = m - 1, sn = n - 1;
  while (fn & 1) { fn >>= 1; sn >>= 1; }
  let fr = path[0], sr = path[0];
  for (const c of path.slice(1)) {
    if (sn === 0) return false;
    if (fn & 1 || fn === sn) {
      fr = await nodeHash(c, fr); sr = await nodeHash(c, sr);
      if (!(fn & 1)) while (fn !== 0 && !(fn & 1)) { fn >>= 1; sn >>= 1; }
    } else {
      sr = await nodeHash(sr, c);
    }
    fn >>= 1; sn >>= 1;
  }
  return sn === 0 && eq(fr, oldRoot) && eq(sr, newRoot);
}

export class Ledger {
  constructor(origin = "caretrail.demo/data-use-log") {
    this.origin = origin;
    this.entries = [];   // what the log shows (can be "tampered" in the demo)
    this.leaves = [];    // leaf hashes committed at write time
    this.checkpoint = null;
    this.first = null;   // first checkpoint a verifier saw, for the consistency check
    this.alg = null;
    this.ready = this.#keys();
  }

  async #keys() {
    try {
      this.key = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
      this.alg = "Ed25519";
    } catch {
      try {
        this.key = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
        this.alg = "ECDSA P-256";
      } catch { this.key = null; this.alg = null; }
    }
  }

  #params() { return this.alg === "Ed25519" ? { name: "Ed25519" } : { name: "ECDSA", hash: "SHA-256" }; }
  #note(size, root) { return enc.encode(`${this.origin}\n${size}\n${b64(root)}\n`); }

  async append(entry) {
    await this.ready;
    const e = { ...entry, i: this.entries.length };
    this.entries.push(e);
    this.leaves.push(await leafHash(enc.encode(canonical(e))));
    await this.#sign();
    return e.i;
  }

  async appendMany(list) {
    await this.ready;
    for (const entry of list) {
      const e = { ...entry, i: this.entries.length };
      this.entries.push(e);
      this.leaves.push(await leafHash(enc.encode(canonical(e))));
    }
    await this.#sign();
    if (!this.first) this.first = this.checkpoint;
  }

  async #sign() {
    const size = this.leaves.length;
    const root = await mth(this.leaves);
    let sig = null;
    if (this.key) sig = new Uint8Array(await crypto.subtle.sign(this.#params(), this.key.privateKey, this.#note(size, root)));
    this.checkpoint = { size, root, sig };
  }

  // Verify a set of entries (one household, or all) against the signed checkpoint.
  async verify(filter = () => true) {
    await this.ready;
    const cp = this.checkpoint;
    const out = { ok: true, checked: 0, badIndex: null, signature: null, consistent: null, size: cp.size, root: hex(cp.root) };
    if (cp.sig && this.key) out.signature = await crypto.subtle.verify(this.#params(), this.key.publicKey, cp.sig, this.#note(cp.size, cp.root));
    if (out.signature === false) out.ok = false;
    for (const e of this.entries) {
      if (!filter(e)) continue;
      const h = await leafHash(enc.encode(canonical(e)));
      const path = await inclusionPath(e.i, this.leaves);
      const okIncl = await verifyInclusion(h, e.i, cp.size, path, cp.root);
      out.checked++;
      if (!okIncl) { out.ok = false; out.badIndex = e.i; break; }
    }
    if (this.first) {
      const proof = await subproof(this.first.size, this.leaves, true);
      out.consistent = await verifyConsistency(this.first.size, cp.size, proof, this.first.root, cp.root);
      if (!out.consistent) out.ok = false;
    }
    return out;
  }

  leafHex(i) { return hex(this.leaves[i]); }
}
