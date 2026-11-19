// FHIR R4 client: imports a household (a Group, or a list of patients) from
// any FHIR R4 server into CareTrail, so the same engine runs on data that
// comes from an EHR or health information exchange.

const TYPES = [
  ["Coverage", "beneficiary"], ["Condition", "patient"], ["FamilyMemberHistory", "patient"], ["Observation", "patient"],
  ["Procedure", "patient"], ["ServiceRequest", "patient"], ["Consent", "patient"], ["Encounter", "patient"], ["Appointment", "patient"],
];

async function get(url, token) {
  const r = await fetch(url, { headers: { accept: "application/fhir+json", ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  if (!r.ok) throw Object.assign(new Error(`FHIR server answered ${r.status} for ${url}`), { status: 502 });
  return r.json();
}

async function searchAll(base, type, param, pid, token) {
  const out = [];
  let url = `${base}/${type}?${param}=Patient/${encodeURIComponent(pid)}&_count=200`;
  for (let page = 0; url && page < 20; page++) {
    const b = await get(url, token);
    out.push(...(b.entry || []).map((e) => e.resource).filter((r) => r?.resourceType === type));
    url = b.link?.find((l) => l.relation === "next")?.url;
    if (!url && b.total > out.length && b.entry?.length) url = `${base}/${type}?${param}=Patient/${encodeURIComponent(pid)}&_count=200&_offset=${out.length}`;
  }
  return out;
}

export async function importFromFhir(ct, base, groupId, token, { patients } = {}) {
  base = String(base).replace(/\/$/, "");
  let group = groupId ? await get(`${base}/Group/${encodeURIComponent(groupId)}`, token) : null;
  const ids = group ? group.member.map((m) => m.entity.reference.split("/")[1]) : patients || [];
  if (!ids.length) throw Object.assign(new Error("Nothing to import: give a Group id or a list of patients"), { status: 400 });
  const resources = [];
  for (const pid of ids) {
    resources.push(await get(`${base}/Patient/${encodeURIComponent(pid)}`, token));
    for (const [type, param] of TYPES) resources.push(...(await searchAll(base, type, param, pid, token)));
  }
  if (!group) group = { resourceType: "Group", id: `import-${Date.now()}`, type: "person", actual: true, name: "Imported household", member: ids.map((id) => ({ entity: { reference: `Patient/${id}` } })) };
  const stripped = [group, ...resources].map(({ meta, ...r }) => r);
  ct.store.putMany(stripped);
  if (!ct.households.some((h) => h.id === group.id)) {
    ct.households.push({ id: group.id, demo: false, imported: true });
    ct.store.kv("households", ct.households);
  }
  ct.refresh(group.id);
  return { household: group.id, patients: ids.length, resources: stripped.length, counts: stripped.reduce((m, r) => ((m[r.resourceType] = (m[r.resourceType] || 0) + 1), m), {}) };
}
