---
title: CareTrail
emoji: 🩺
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: apache-2.0
short_description: Family screening passport, FHIR R4 backend
---

# CareTrail

A family screening passport, a clinician review console and an adaptive population outreach engine for Abu Dhabi's preventive screening programs (IFHAS adult screening and Well-Child visits).
Built by team **FedTrail** for the Future Health Digital Innovation Challenge, challenge statement *[Population Health] Precision Prevention and Screening*.

**Live app:** https://bbahat.github.io/caretrail/ (opens the live server; no password, pick a demo role)
**Server:** https://caretrail.onrender.com · **FHIR R4:** https://caretrail.onrender.com/fhir/metadata

Free hosting sleeps when idle; the first load can take up to a minute.

> Prototype on synthetic data only. Not a medical device and not clinical advice.

## What it does

| Role | What they see and do |
|---|---|
| **Family** | One person manages reminders for the household. Next steps ordered by clinical priority, each with its reason, the data used, the DoH source section and who decides. Book a real slot (FHIR `Appointment`), postpone or decline (respected for 12 months), set consent per person and data type, and verify every use of their data in the browser. |
| **Clinician** | Open follow-ups (abnormal results without a completed referral) with the DoH deadlines, and AI trend suggestions to approve or reject. Nothing reaches a family until a clinician decides. |
| **Program team** | Live KPIs against the DoH targets, a pseudonymous outreach queue, a calibrated lapse model with a model card, subgroup safeguards with small-cell suppression, and adaptive outreach that learns which channel works for whom. Opening a record needs a stated purpose and is logged. |

## Architecture

```
FHIR R4 store (SQLite) ──► mapping (consent enforced) ──► guideline engine (DoH rules)
        ▲                                               ├─► trend engine (labs) ─► clinician review ─► family
        │                                               ├─► wearable change detection ─► family nudge
   any FHIR R4 server                                   └─► lapse model + Thompson sampling ─► outreach queue
   (import client)
                         every write ─► Merkle data-use log (Ed25519 checkpoints) + FHIR AuditEvent ─► verified in the browser
```

- **Server:** Node.js 22, no external dependencies (`node:http`, `node:sqlite`, `node:crypto`).
- **FHIR R4:** `Patient`, `Group` (household), `Coverage`, `Condition`, `FamilyMemberHistory`, `Observation` (labs, vitals, wearables, genomics, child screening), `Procedure`, `ServiceRequest` (referrals and clinician plans), `Consent`, `Encounter`, `Schedule`, `Slot`, `Appointment`, `Location`, `AuditEvent`. Read and search at `/fhir`, role-based access.
- **Interoperability:** `server/fhir/client.mjs` imports a household from any FHIR R4 server (`POST /api/program/import`, allowlisted base URLs). Tested server-to-server. The mapping round-trips the whole synthetic population with identical engine output (tested).
- **Consent:** genomic and wearable data are dropped at the data layer when consent is off, both in the engine input and in FHIR reads.
- **Rules engine:** `src/engine.js`, from the DoH IFHAS Standard V10 (July 2025) and Well-Child Visit Standard V10 (December 2025), with section references in `data/rules.json`.
- **Trend engine:** per-person linear trend of HbA1c, systolic blood pressure and LDL; proposes an earlier recheck when the trajectory heads toward a standard threshold. It can only bring a check forward, never push it back (tested), and a clinician must approve it.
- **Lapse model:** L2 logistic regression trained in the server on engagement, household, clinical, family-history, trend and wearable features; holdout AUC, Brier and calibration shown live; retrained after each outreach week. Orders outreach only within a clinical tier.
- **Adaptive outreach:** Thompson sampling over channel × message framing per language and age group, compared every week with today's practice (the same SMS for everyone). The response rates it learns from are simulated.
- **Data-use log:** append-only Merkle log (RFC 6962 hashing), Ed25519-signed checkpoints, inclusion and consistency proofs verified in the browser with WebCrypto.

## Run it

```bash
npm test                  # 25 tests: engine, FHIR round trip, consent, ledger, server rules
npm start                 # http://localhost:7860
docker build -t caretrail . && docker run -p 7860:7860 caretrail
# Render: New > Web Service > this repo > Docker > Free
```

Environment: `PORT` (7860), `DB_PATH` (/tmp/caretrail.db), `LEDGER_KEY` (PEM, optional), `FHIR_IMPORT_ALLOW` (comma-separated base URLs).
Demo data is seeded on first start and can be reset from the program view.

## Data

All people, families, results, labs, wearable data, clinics and slots are synthetic (seeded). No real patient, hospital or confidential data is used. In a pilot, records would come from Malaffi, the app channel would be Sahatna and eligibility from Thiqa; that needs DoH data-sharing approval.

## Pre-existing work

The data-use log follows the design of [FedTrail](https://github.com/bbahat/fedtrail), the team's earlier open-source project (Apache-2.0). Everything else was built during the challenge.

## Limits

- Arabic text is a first draft and needs review by a native speaker; Urdu and Tagalog are flagged for interpreters.
- The outreach model and the bandit run on synthetic outcomes; they show the method and its safeguards, not real-world performance.
- No connection to a production EHR; the FHIR import has been tested between CareTrail instances only.

## License

Apache-2.0
