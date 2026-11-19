// Browser-side verification of the server's data-use log (RFC 9162 proofs,
// Ed25519 checkpoint signature). The server sends entries, inclusion paths
// and a signed checkpoint; this code checks them without trusting the server.

const enc = new TextEncoder();
const fromHex = (h) => Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16));
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
async function sha256(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { buf.set(p, o); o += p.length; }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}
const nodeHash = (l, r) => sha256(Uint8Array.of(1), l, r);
export const leafHash = (bytes) => sha256(Uint8Array.of(0), bytes);

export function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

export async function verifyInclusion(leaf, index, size, path, root) {
  if (index >= size) return false;
  let fn = index, sn = size - 1, r = leaf;
  for (const p of path) {
    if (sn === 0) return false;
    if (fn & 1 || fn === sn) {
      r = await nodeHash(p, r);
      if (!(fn & 1)) while (fn !== 0 && !(fn & 1)) { fn >>= 1; sn >>= 1; }
    } else r = await nodeHash(r, p);
    fn >>= 1; sn >>= 1;
  }
  return sn === 0 && eq(r, root);
}

export async function verifyConsistency(m, n, proof, oldRoot, newRoot) {
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
    } else sr = await nodeHash(sr, c);
    fn >>= 1; sn >>= 1;
  }
  return sn === 0 && eq(fr, oldRoot) && eq(sr, newRoot);
}

async function verifySignature(cp) {
  try {
    const key = await crypto.subtle.importKey("raw", fromHex(cp.publicKey), { name: "Ed25519" }, false, ["verify"]);
    const note = enc.encode(`${cp.origin}\n${cp.size}\n${btoa(String.fromCharCode(...fromHex(cp.root)))}\n`);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, fromHex(cp.signature), note);
  } catch {
    return null; // browser without Ed25519 support
  }
}

// data: response of GET /api/ledger. first: {size, root} seen earlier, if any.
export async function verifyLog(data, first) {
  const cp = data.checkpoint;
  const root = fromHex(cp.root);
  const out = { ok: true, checked: 0, badIndex: null, signature: await verifySignature(cp), consistent: null, size: cp.size };
  if (out.signature === false) out.ok = false;
  for (const e of data.entries) {
    const leaf = await leafHash(enc.encode(canonical(e.entry)));
    const ok = await verifyInclusion(leaf, e.entry.i, cp.size, e.path.map(fromHex), root);
    out.checked++;
    if (!ok) { out.ok = false; out.badIndex = e.entry.i; break; }
  }
  if (first && data.consistency && first.size === data.consistency.from) {
    out.consistent = await verifyConsistency(first.size, cp.size, data.consistency.proof.map(fromHex), fromHex(first.root), root);
    if (!out.consistent) out.ok = false;
  }
  return out;
}
