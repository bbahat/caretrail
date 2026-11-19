// FHIR resource store on SQLite (node:sqlite, no external dependencies).
// Resources are stored as JSON with versionId and lastUpdated, indexed by
// type, patient and household so a household's record loads in one query.

import { DatabaseSync } from "node:sqlite";
import { findCode } from "./codes.mjs";

const refId = (r) => (r?.reference || "").split("/").pop();

export class FhirStore {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS resources (
        type TEXT NOT NULL, id TEXT NOT NULL, household TEXT, patient TEXT,
        version INTEGER NOT NULL, updated TEXT NOT NULL, json TEXT NOT NULL,
        PRIMARY KEY (type, id));
      CREATE INDEX IF NOT EXISTS res_household ON resources(household);
      CREATE INDEX IF NOT EXISTS res_patient ON resources(type, patient);
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    this.patientHousehold = new Map();
    for (const row of this.db.prepare("SELECT json FROM resources WHERE type = 'Group'").all()) {
      const g = JSON.parse(row.json);
      for (const m of g.member || []) this.patientHousehold.set(refId(m.entity), g.id);
    }
    this.q = {
      get: this.db.prepare("SELECT json FROM resources WHERE type = ? AND id = ?"),
      put: this.db.prepare(`INSERT INTO resources (type, id, household, patient, version, updated, json) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(type, id) DO UPDATE SET household = excluded.household, patient = excluded.patient, version = excluded.version, updated = excluded.updated, json = excluded.json`),
      byHousehold: this.db.prepare("SELECT json FROM resources WHERE household = ?"),
      byPatient: this.db.prepare("SELECT json FROM resources WHERE type = ? AND patient = ?"),
      byType: this.db.prepare("SELECT json FROM resources WHERE type = ?"),
      count: this.db.prepare("SELECT type, COUNT(*) AS n FROM resources GROUP BY type"),
      kvGet: this.db.prepare("SELECT value FROM kv WHERE key = ?"),
      kvSet: this.db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
    };
  }

  isEmpty() { return this.q.count.all().length === 0; }
  counts() { return Object.fromEntries(this.q.count.all().map((r) => [r.type, r.n])); }
  kv(key, value) {
    if (value === undefined) { const r = this.q.kvGet.get(key); return r ? JSON.parse(r.value) : undefined; }
    this.q.kvSet.run(key, JSON.stringify(value));
    return value;
  }

  #patientOf(r) {
    if (r.resourceType === "Patient") return r.id;
    return refId(r.subject || r.patient || r.beneficiary || r.participant?.find((p) => p.actor?.reference?.startsWith("Patient/"))?.actor) || null;
  }

  put(resource, { now = new Date().toISOString() } = {}) {
    const prev = this.get(resource.resourceType, resource.id);
    const version = prev ? Number(prev.meta?.versionId || 1) + 1 : 1;
    const r = { ...resource, meta: { ...(resource.meta || {}), versionId: String(version), lastUpdated: now } };
    if (r.resourceType === "Group") for (const m of r.member || []) this.patientHousehold.set(refId(m.entity), r.id);
    const patient = this.#patientOf(r);
    const household = r.resourceType === "Group" ? r.id : this.patientHousehold.get(patient) || null;
    this.q.put.run(r.resourceType, r.id, household, patient, version, now, JSON.stringify(r));
    return r;
  }

  putMany(list, opts) {
    this.db.exec("BEGIN");
    try {
      for (const r of list) if (r.resourceType === "Group") for (const m of r.member || []) this.patientHousehold.set(refId(m.entity), r.id);
      for (const r of list) this.put(r, opts);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  get(type, id) {
    const row = this.q.get.get(type, id);
    return row ? JSON.parse(row.json) : null;
  }
  household(id) { return this.q.byHousehold.all(id).map((r) => JSON.parse(r.json)); }
  forPatient(type, pid) { return this.q.byPatient.all(type, pid).map((r) => JSON.parse(r.json)); }
  all(type) { return this.q.byType.all(type).map((r) => JSON.parse(r.json)); }
  householdOf(pid) { return this.patientHousehold.get(pid); }

  // A pragmatic subset of FHIR search: _id, patient/subject, code, category,
  // status, date/start (ge/le), schedule, service-type, member, _count, _offset.
  search(type, params) {
    const pid = refId({ reference: params.patient || params.subject || params.beneficiary || "" }) || null;
    let rows = pid ? this.forPatient(type, pid) : null;
    const filters = [];
    const tok = (concept, v) => {
      const [sys, code] = v.includes("|") ? v.split("|") : [null, v];
      const list = Array.isArray(concept) ? concept : [concept];
      return list.some((c) => (c?.coding || []).some((x) => x.code === code && (!sys || x.system === sys)) || c?.text === code);
    };
    if (params._id) filters.push((r) => params._id.split(",").includes(r.id));
    if (params.code) filters.push((r) => params.code.split(",").some((v) => tok(r.code, v)));
    if (params.category) filters.push((r) => tok(r.category, params.category));
    if (params.status) filters.push((r) => params.status.split(",").includes(r.status));
    if (params["service-type"]) filters.push((r) => tok(r.serviceType, params["service-type"]));
    if (params.schedule) filters.push((r) => refId(r.schedule) === refId({ reference: params.schedule }));
    if (params.member) filters.push((r) => (r.member || []).some((m) => refId(m.entity) === refId({ reference: params.member })));
    for (const key of ["date", "start"]) {
      for (const v of [].concat(params[key] || [])) {
        const op = v.slice(0, 2), val = /^(ge|le|gt|lt)/.test(v) ? v.slice(2) : v;
        const get = (r) => r.start || r.effectiveDateTime || r.performedDateTime || r.authoredOn || r.recorded || r.dateTime || r.date || r.effectivePeriod?.start || "";
        filters.push((r) => { const x = get(r).slice(0, val.length); return op === "ge" ? x >= val : op === "le" ? x <= val : op === "gt" ? x > val : op === "lt" ? x < val : x === val; });
      }
    }
    const count = Math.min(Number(params._count || 50), 500);
    const offset = Number(params._offset || 0);
    const matched = [];
    let total = 0;
    const consider = (r) => {
      if (filters.every((f) => f(r))) {
        if (total >= offset && matched.length < count) matched.push(r);
        total++;
      }
    };
    if (rows) rows.forEach(consider);
    else for (const row of this.q.byType.iterate(type)) consider(JSON.parse(row.json));
    return { total, entries: matched };
  }
}

export { findCode };
