// Builds the synthetic FHIR dataset: households from data/population.json and
// data/demo_families.json, plus longitudinal labs, weekly wearable telemetry,
// clinics, schedules and bookable slots. Everything is synthetic and seeded.

import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { toFhir } from "./fhir/mapping.mjs";
import { CS, cc } from "./fhir/codes.mjs";
import { rng, addDays, round } from "./util.mjs";

const dataUrl = (f) => new URL(`../data/${f}`, import.meta.url);

export function loadPopulation() {
  if (existsSync(dataUrl("population.json"))) return JSON.parse(readFileSync(dataUrl("population.json")));
  return JSON.parse(gunzipSync(readFileSync(dataUrl("population.json.gz"))));
}

const DEMO_LABS = {
  "DEMO-1-01": { hba1c: [5.5, 5.7, 5.9, 6.2], sbp: [116, 118, 117, 121], ldl: [118, 121, 119, 124], bmi: [26.1, 26.8, 27.4, 28.1] },
  "DEMO-1-02": { hba1c: [5.4, 5.4, 5.5, 5.5], sbp: [124, 126, 125, 128], ldl: [178, 185, 196, 204], bmi: [27.0, 27.2, 27.5, 27.6] },
  "DEMO-1-03": { hba1c: [6.9, 7.0, 7.1, 7.1], sbp: [132, 136, 141, 147], ldl: [110, 108, 112, 109], bmi: [29.0, 29.1, 29.3, 29.2] },
};
const LAB_DATES = ["2023-10-10", "2024-10-08", "2025-10-14", "2026-09-22"];

function labsFor(p, r, ref) {
  if (DEMO_LABS[p.id]) {
    const d = DEMO_LABS[p.id];
    return Object.fromEntries(Object.entries(d).map(([k, vals]) => [k, vals.map((v, i) => ({ date: LAB_DATES[i], value: v }))]));
  }
  const c = new Set(p.conditions || []);
  const fh = new Set(p.family_history || []);
  const last = p.screening?.major?.last_done;
  const n = last ? 4 : r() < 0.35 ? 2 : 0;
  if (!n) return null;
  const end = last || addDays(ref, -Math.floor(r() * 500));
  const dates = Array.from({ length: n }, (_, i) => addDays(end, -(n - 1 - i) * (330 + Math.floor(r() * 70))));
  const series = (base, slope, sd, dp, lo, hi) => dates.map((dt, i) => ({ date: dt, value: round(Math.min(hi, Math.max(lo, base + slope * i + r.normal(0, sd))), dp) }));
  const dm = c.has("diabetes") || c.has("type1_diabetes");
  const hb = series(dm ? r.normal(7.2, 0.7) : r.normal(5.35, 0.28), dm ? r.normal(0.05, 0.15) : fh.has("diabetes") || c.has("obesity") ? r.normal(0.12, 0.08) : r.normal(0.02, 0.05), 0.08, 1, 4.3, 12);
  const sbp = series((c.has("hypertension") ? r.normal(136, 9) : r.normal(119, 9)) + (c.has("obesity") ? 5 : 0), r.normal(c.has("hypertension") ? 1.5 : 0.8, 2.5), 4, 0, 90, 200);
  const ldl = series((c.has("high_cholesterol") ? r.normal(160, 18) : r.normal(114, 22)) + ((p.genomic_findings || []).includes("Familial hypercholesterolemia") ? 60 : 0), r.normal(1, 5), 6, 0, 40, 320);
  const bmi = series(c.has("obesity") ? r.normal(33, 2.5) : r.normal(25.2, 2.8), r.normal(0.2, 0.35), 0.3, 1, 16, 55);
  return { hba1c: hb, sbp, ldl, bmi };
}

function wearableHistory(p, r) {
  const w = p.wearable;
  if (!w) return null;
  const kind = p.id === "DEMO-1-01" ? "steps_drop" : p.id === "DEMO-3-02" ? "rhr_rise" : r() < 0.14 ? "steps_drop" : r() < 0.1 ? "rhr_rise" : "stable";
  return Array.from({ length: 8 }, () => ({
    steps_per_day: Math.round(kind === "steps_drop" ? w.steps_per_day * (1.45 + r.normal(0, 0.05)) : w.steps_per_day * (1 + r.normal(0, 0.06))),
    sleep_hours: round(kind === "steps_drop" ? w.sleep_hours + 0.6 + r.normal(0, 0.15) : w.sleep_hours + r.normal(0, 0.2), 1),
    resting_hr: Math.round(kind === "rhr_rise" ? w.resting_hr - 8 + r.normal(0, 1) : w.resting_hr + r.normal(0, 1)),
  }));
}

function jitter(r) {
  const pair = (s, dp) => { const a = round(Math.abs(r.normal(0, s)), dp), b = round(Math.abs(r.normal(0, s)), dp); return [a, -a, b, -b]; };
  return { steps: pair(350, 0), sleep: pair(0.25, 1), rhr: pair(1.5, 0) };
}

export const CLINICS = [
  { id: "clinic-adc-1", name: "Family Health Centre 1, Abu Dhabi City (demo)", region: "Abu Dhabi City" },
  { id: "clinic-adc-2", name: "Family Health Centre 2, Abu Dhabi City (demo)", region: "Abu Dhabi City" },
  { id: "clinic-ain-1", name: "Family Health Centre 1, Al Ain (demo)", region: "Al Ain" },
  { id: "clinic-ain-2", name: "Family Health Centre 2, Al Ain (demo)", region: "Al Ain" },
  { id: "clinic-dha-1", name: "Family Health Centre 1, Al Dhafra (demo)", region: "Al Dhafra" },
];
export const SERVICES = { screening: "Adult screening (IFHAS)", child: "Well-Child visit", specialist: "Specialist follow-up", recheck: "Lab or blood pressure recheck" };

function schedulingResources(ref) {
  const out = [];
  for (const c of CLINICS) {
    out.push({ resourceType: "Location", id: c.id, status: "active", name: c.name, address: { city: c.region, country: "AE" } });
    for (const [svc, label] of Object.entries(SERVICES)) {
      const sid = `sched-${c.id}-${svc}`;
      out.push({ resourceType: "Schedule", id: sid, active: true, serviceType: [cc(CS.slotService, svc, label)], actor: [{ reference: `Location/${c.id}`, display: c.name }] });
      for (let d = 1; d <= 16; d++) {
        const day = addDays(ref, d);
        const dow = new Date(day + "T00:00:00Z").getUTCDay();
        if (dow === 6 || dow === 0) continue; // UAE weekend
        for (const hm of ["08:00", "08:40", "09:20", "10:00", "10:40", "11:20", "13:00", "13:40", "14:20"]) {
          const start = `${day}T${hm}:00+04:00`;
          const [h, m] = hm.split(":").map(Number);
          const endMin = h * 60 + m + 30;
          const end = `${day}T${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}:00+04:00`;
          out.push({ resourceType: "Slot", id: `slot-${c.id}-${svc}-${day.replaceAll("-", "")}-${hm.replace(":", "")}`, schedule: { reference: `Schedule/${sid}` }, status: "free", start, end, serviceType: [cc(CS.slotService, svc, label)] });
        }
      }
    }
  }
  return out;
}

export function buildSeed(refOverride) {
  const POP = loadPopulation();
  const DEMO = JSON.parse(readFileSync(dataUrl("demo_families.json")));
  const ref = refOverride || DEMO.meta.reference_date;
  const r = rng(2026);
  const households = [];
  const ops = [];
  const resources = [];
  const all = [...DEMO.households.map((h) => ({ ...h, demo: true })), ...POP.households];
  for (const src of all) {
    const hh = structuredClone(src);
    hh.reference_date = ref;
    for (const p of hh.members) {
      if (p.id === "DEMO-3-02") { p.consent.wearables = true; p.wearable = { steps_per_day: 8100, sleep_hours: 7.1, resting_hr: 72 }; }
      if (p.kind === "adult") {
        const labs = labsFor(p, r, ref);
        if (labs) p._labs = labs;
        const hist = wearableHistory(p, r);
        if (hist) { p._wearable_history = hist; p._wearable_jitter = jitter(r); }
      }
      ops.push({
        person: p.id,
        household: hh.id,
        engagement: p.engagement || { invites_3y: 0, responded_3y: 0, declined_12m: 0, no_show_3y: 0 },
        p_complete: p._p_complete_90d ?? 0.6,
        outcome: p._outcome_completes_90d ?? true,
      });
    }
    households.push({ id: hh.id, demo: !!src.demo });
    resources.push(...toFhir(hh));
  }
  const demoIds = new Set(DEMO.households.map((h) => h.id));
  resources.push(...schedulingResources(ref));
  return { ref, households, ops, resources, demoIds: [...demoIds] };
}
