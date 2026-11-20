// CareTrail HTTP server: JSON API, FHIR R4 REST endpoint, server-sent
// events and the web app. Node.js 22+, no external dependencies.
//   node server/index.mjs      (PORT, DB_PATH, FHIR_IMPORT_ALLOW env vars)

import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, rmSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { CareTrail, PERSONAS, SERVICES } from "./app.mjs";
import { importFromFhir } from "./fhir/client.mjs";

const PORT = Number(process.env.PORT || 7860);
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WEB = join(ROOT, "web");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };

let ct = new CareTrail();
console.log(`CareTrail ready in ${ct.bootMs} ms: ${ct.households.length} households, ledger ${ct.ledger.entries.length} entries`);

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(body));
};
const fhirJson = (res, status, body) => json(res, status, body, { "content-type": "application/fhir+json; charset=utf-8" });
const outcome = (status, msg) => ({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: status === 404 ? "not-found" : status === 403 ? "forbidden" : "invalid", diagnostics: msg }] });

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 1e6) throw Object.assign(new Error("Body too large"), { status: 413 }); chunks.push(c); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
}

function auth(req, url) {
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : url.searchParams.get("token");
  return ct.verifyToken(tok);
}
function need(user, ...roles) {
  if (!user) throw Object.assign(new Error("Sign in first (choose a demo role)."), { status: 401 });
  if (roles.length && !roles.includes(user.role)) throw Object.assign(new Error(`This needs the ${roles.join(" or ")} role.`), { status: 403 });
  return user;
}

// ------------------------------------------------------------------ FHIR REST

const FHIR_TYPES = ["Patient", "Group", "Coverage", "Condition", "FamilyMemberHistory", "Observation", "Procedure", "ServiceRequest", "Consent", "Encounter", "Appointment", "Slot", "Schedule", "Location", "AuditEvent"];

function capability(base) {
  return {
    resourceType: "CapabilityStatement",
    status: "active",
    date: ct.ref,
    kind: "instance",
    software: { name: "CareTrail FHIR facade", version: "0.2.0" },
    implementation: { description: "CareTrail synthetic FHIR R4 server (demo data only)", url: base },
    fhirVersion: "4.0.1",
    format: ["json"],
    rest: [{
      mode: "server",
      security: { description: "Bearer token from POST /api/login. Families see their own household; clinicians see all; the program role has no record-level FHIR access." },
      resource: FHIR_TYPES.map((type) => ({ type, interaction: [{ code: "read" }, { code: "search-type" }], searchParam: ["_id", "patient", "subject", "code", "category", "status", "date", "_count", "_offset"].map((name) => ({ name, type: "token" })) })),
    }],
  };
}

function fhirAllowed(user, resource) {
  if (!resource) return true;
  if (["Slot", "Schedule", "Location"].includes(resource.resourceType)) return true;
  if (user.role === "clinician") return true;
  if (user.role === "family") {
    const hh = resource.resourceType === "Group" ? resource.id : ct.store.householdOf(resource.resourceType === "Patient" ? resource.id : (resource.subject || resource.patient || resource.beneficiary || resource.participant?.find((p) => p.actor?.reference?.startsWith("Patient/"))?.actor)?.reference?.split("/")[1]);
    return hh === user.hh;
  }
  return false;
}

async function handleFhir(req, res, url, parts) {
  const base = `${url.protocol}//${url.host}/fhir`;
  if (parts[0] === "metadata") return fhirJson(res, 200, capability(base));
  const user = auth(req, url);
  if (!user) return fhirJson(res, 401, outcome(401, "Bearer token required. POST /api/login with a demo persona."));
  if (user.role === "program") return fhirJson(res, 403, outcome(403, "The program role works with pseudonymous aggregates and has no record-level FHIR access."));
  const [type, id] = parts;
  if (!FHIR_TYPES.includes(type)) return fhirJson(res, 404, outcome(404, `Unsupported resource type ${type}`));
  if (req.method !== "GET") return fhirJson(res, 405, outcome(405, "This demo endpoint is read-only. Use the CareTrail API to write."));
  if (id) {
    const r = ct.store.get(type, id);
    if (!r) return fhirJson(res, 404, outcome(404, `${type}/${id} not found`));
    if (!fhirAllowed(user, r)) return fhirJson(res, 403, outcome(403, "Not allowed"));
    if (r.resourceType === "Observation" && !consentOk(r)) return fhirJson(res, 403, outcome(403, "Consent for this data category is not active"));
    return fhirJson(res, 200, r);
  }
  const params = Object.fromEntries(url.searchParams);
  const dates = url.searchParams.getAll("date");
  if (dates.length > 1) params.date = dates;
  if (user.role === "family" && !params.patient && !params.subject && !["Slot", "Schedule", "Location", "Group"].includes(type)) {
    return fhirJson(res, 400, outcome(400, "Family users must search with patient=Patient/{id} for a member of their household"));
  }
  const { total, entries } = ct.store.search(type, params);
  const visible = entries.filter((r) => fhirAllowed(user, r) && (r.resourceType !== "Observation" || consentOk(r)));
  return fhirJson(res, 200, {
    resourceType: "Bundle",
    type: "searchset",
    total,
    link: [{ relation: "self", url: url.href }],
    entry: visible.map((r) => ({ fullUrl: `${base}/${r.resourceType}/${r.id}`, resource: r, search: { mode: "match" } })),
  });
}

// Data-layer consent check on genomic and wearable Observations.
function consentOk(obs) {
  const cat = (obs.extension || []).find((e) => e.url.endsWith("data-category"))?.valueString;
  if (!cat) return true;
  const pid = obs.subject.reference.split("/")[1];
  const c = ct.store.get("Consent", `consent-${pid}-${cat === "genomic" ? "genomic" : "wearables"}`);
  return c?.status === "active" && c.provision?.type === "permit";
}

// ------------------------------------------------------------------ API

const routes = {
  "GET /api/meta": () => ({ ref: ct.ref, personas: PERSONAS, services: SERVICES, households: ct.households.length, fhir: ct.store.counts(), ledger: ct.ledger.checkpoint(), model_version: ct.model.version, boot_ms: ct.bootMs }),
  "POST /api/login": async (req) => { const b = await body(req); const t = ct.token(b.persona); if (!t) throw Object.assign(new Error("Unknown persona"), { status: 400 }); return t; },
  "GET /api/family": (req, url, user) => ct.familyView(need(user, "family")),
  "POST /api/family/consent": async (req, url, user) => { const b = await body(req); ct.setConsent(need(user, "family"), b.patient, b.category, !!b.value); return ct.familyView(user); },
  "POST /api/family/decline": async (req, url, user) => { const b = await body(req); ct.decline(need(user, "family"), b.patient, b.key); return ct.familyView(user); },
  "POST /api/family/snooze": async (req, url, user) => { const b = await body(req); ct.snooze(need(user, "family"), b.itemId, b.patient, b.days || 30); return ct.familyView(user); },
  "GET /api/family/slots": (req, url, user) => ct.slots(need(user, "family"), url.searchParams.get("service") || "screening"),
  "POST /api/family/book": async (req, url, user) => { const b = await body(req); const appt = ct.book(need(user, "family"), b); return { appointment: appt, view: ct.familyView(user) }; },
  "POST /api/family/cancel": async (req, url, user) => { const b = await body(req); ct.cancel(need(user, "family"), b.appointmentId); return ct.familyView(user); },
  "GET /api/clinician/queue": (req, url, user) => (need(user, "clinician"), ct.clinicianQueue()),
  "GET /api/clinician/patient": (req, url, user) => (need(user, "clinician"), ct.clinicianPatient(url.searchParams.get("id"))),
  "POST /api/clinician/referral": async (req, url, user) => { const b = await body(req); ct.referral(need(user, "clinician"), b); return ct.clinicianQueue(); },
  "POST /api/clinician/suggestion": async (req, url, user) => { const b = await body(req); ct.decideSuggestion(need(user, "clinician"), b); return ct.clinicianQueue(); },
  "GET /api/program/overview": (req, url, user) => (need(user, "program"), ct.overview()),
  "GET /api/program/queue": (req, url, user) => (need(user, "program"), ct.queue({ offset: Number(url.searchParams.get("offset") || 0) })),
  "POST /api/program/open": async (req, url, user) => { const b = await body(req); return ct.openRecord(need(user, "program"), b.pseudonym, b.purpose); },
  "GET /api/program/bandit": (req, url, user) => (need(user, "program"), ct.banditView()),
  "POST /api/program/week": (req, url, user) => ct.runOutreachWeek(need(user, "program")),
  "POST /api/program/retrain": (req, url, user) => (need(user, "program"), ct.retrain()),
  "POST /api/program/import": async (req, url, user) => {
    need(user, "program", "clinician");
    const b = await body(req);
    const allow = (process.env.FHIR_IMPORT_ALLOW || "").split(",").filter(Boolean);
    if (!allow.some((a) => String(b.base || "").startsWith(a))) throw Object.assign(new Error("This FHIR base URL is not on the server's import allowlist (FHIR_IMPORT_ALLOW)."), { status: 403 });
    const r = await importFromFhir(ct, b.base, b.group, b.token);
    return r;
  },
  "POST /api/admin/reset": (req, url, user) => {
    need(user, "program");
    const path = ct.dbPath;
    ct.close();
    for (const s of ["", "-wal", "-shm"]) { try { rmSync(path + s); } catch { /* none */ } }
    ct = new CareTrail({ dbPath: path });
    for (const fn of sseClients) fn({ type: "reset" });
    return { ok: true, boot_ms: ct.bootMs };
  },
  "POST /api/demo/reset": () => {
    if (Date.now() - (lastVisitorReset || 0) < 5000) throw Object.assign(new Error("Just reset. Try again in a few seconds."), { status: 429 });
    lastVisitorReset = Date.now();
    return ct.resetDemo("visitor");
  },
  "GET /api/family/export": (req, url, user) => ct.exportFamily(need(user, "family")),
  "GET /api/ledger": (req, url, user) => ct.ledgerFor(need(user), Number(url.searchParams.get("from") || 0)),
};

const sseClients = new Set();
let lastVisitorReset = 0;
// Reset the demo families after 20 quiet minutes, so each reviewer starts clean.
setInterval(() => {
  if (ct.demoDirty && Date.now() - (ct.lastDemoWrite || 0) > 20 * 60 * 1000) ct.resetDemo("automatic after 20 idle minutes");
}, 60 * 1000).unref();
function sse(req, res, url) {
  const user = auth(req, url);
  if (!user) return json(res, 401, { error: "Sign in first" });
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
  res.write("retry: 3000\n\n");
  const send = (ev) => {
    if (user.role === "family" && ev.hh && ev.hh !== user.hh && ev.type !== "reset") return;
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };
  sseClients.add(send);
  ct.listeners.add(send);
  const ping = setInterval(() => res.write(": ping\n\n"), 20000);
  req.on("close", () => { clearInterval(ping); sseClients.delete(send); ct.listeners.delete(send); });
}

function serveStatic(res, path) {
  let p = normalize(join(WEB, path === "/" ? "index.html" : path));
  if (!p.startsWith(WEB)) return json(res, 403, { error: "Forbidden" });
  if (!existsSync(p) || statSync(p).isDirectory()) p = join(WEB, "index.html");
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-cache" });
  res.end(readFileSync(p));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.headers["x-forwarded-proto"]) url.protocol = req.headers["x-forwarded-proto"] + ":";
  try {
    if (url.pathname === "/api/events") return sse(req, res, url);
    if (url.pathname.startsWith("/fhir")) return await handleFhir(req, res, url, url.pathname.split("/").slice(2).filter(Boolean));
    if (url.pathname === "/healthz") return json(res, 200, { ok: true });
    const route = routes[`${req.method} ${url.pathname}`];
    if (route) {
      const user = auth(req, url);
      return json(res, 200, await route(req, url, user));
    }
    if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "Not found" });
    return serveStatic(res, url.pathname);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    return json(res, status, { error: e.message });
  }
});
server.listen(PORT, () => console.log(`CareTrail listening on http://localhost:${PORT}`));
