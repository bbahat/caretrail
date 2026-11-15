# CareTrail

A family screening passport and a population view for Abu Dhabi's preventive screening programs.
Built by team **FedTrail** for the Future Health Digital Innovation Challenge,
challenge statement *[Population Health] Precision Prevention and Screening*.

**Live demo:** https://bbahat.github.io/caretrail/ (no login, no install; English and Arabic)

> Prototype on synthetic data only. Not a medical device and not clinical advice.

## What it does

- **Family app.** One person manages reminders for the whole household. CareTrail turns each
  member's record into the next steps that matter this month, ordered by clinical priority:
  open follow-ups first (an abnormal result with no completed referral), then higher-risk and
  overdue screenings. Every reminder says why, which data it used, which section of the DoH
  standard it comes from, and whether it is a program reminder or a decision for the doctor.
- **Consent that changes the result.** Genomic results and wearable data are used only with the
  person's consent. Switching consent off updates the reasons at once. Adults can keep their
  screening private from the family manager. A postponed screening is respected for 12 months.
- **Program view.** The same engine runs over a synthetic population of 4,309 people:
  participation against the 85% target, referrals against the 100% target, a calibrated outreach
  model with a model card, subgroup safeguards with small-cell suppression, and a pseudonymous
  outreach queue.
- **Data-use log.** Every consent change, result, booking and staff access is appended to a Merkle
  log (RFC 6962 hashing) with a signed checkpoint. A family can verify its own entries in the
  browser, and the demo shows what happens when an entry is edited after the fact.

## Try it in two minutes

1. Al Mansouri family: open **Why this?** on Khalid's open follow-up.
2. **Privacy**: switch off Mariam's wearable data and go back to **Next steps**.
3. **Data log**: press **Verify log**, then **Simulate tampering**, then verify again.
4. Khan family: a stuck autism referral, and adults outside Thiqa.
5. **Program view**: open a record from the outreach queue; the access appears in the program log.

## Rules and sources

All rules are in [`data/rules.json`](data/rules.json), each with its source section:

- DoH Standard for the Periodic Comprehensive Screening Program for Adults (IFHAS),
  DoH/SD/ADPHC-CHS/IFHAS/V10/2025, July 2025.
- DoH Standard for Well-Child Visits, DOH/WCV/SD/10/2025, V10, December 2025.

Assumptions where the standards are silent (for example, when "due" becomes "overdue") are listed
in the same file and on the program view. Childhood immunizations follow a separate DoH schedule
and are not encoded.

## How it is built

| Part | File |
|---|---|
| Guideline engine (runs in the browser and in Node) | `src/engine.js` |
| Synthetic population (seed 42) | `tools/generate_population.py` |
| Demo families | `tools/demo_families.py` → `data/demo_families.json` |
| Population run of the engine | `tools/run_population.mjs` |
| Outreach model, calibration, safeguards, policy simulation | `tools/analytics.py` → `data/dashboard.json` |
| Merkle data-use log | `app/ledger.js` |
| App and translations | `app/app.js`, `app/i18n.js`, `app/styles.css` |
| Single-file build | `tools/build.mjs` → `index.html` |

No framework and no runtime dependencies. The page loads fonts from Google Fonts and nothing else.

```bash
npm test                      # engine and ledger tests (Node 20+)
node tools/build.mjs          # rebuild index.html
python3 -m http.server        # then open http://localhost:8000

# regenerate synthetic data (Python 3.11+, numpy, scikit-learn)
python3 tools/generate_population.py && node tools/run_population.mjs && python3 tools/analytics.py
python3 tools/demo_families.py
```

## Data

All people, families and results are synthetic. No real patient data, hospital data or
confidential material is used. Prevalences are illustrative and are not estimates of the
Abu Dhabi population. In a pilot the record would come from Malaffi, the app channel would be
Sahatna, and eligibility from Thiqa.

## Pre-existing work

The data-use log reuses the design of [FedTrail](https://github.com/bbahat/fedtrail), an earlier
open-source project by the same team (Apache-2.0): a tamper-evident log for federated learning.
Everything else in this repository was built during the challenge.

## Limits

- Arabic text is a first draft and needs review by a native speaker.
- Urdu and Tagalog are flagged for interpreters in the program view; the app UI is English and Arabic.
- Booking is simulated. The outreach model is trained on synthetic data and is shown to illustrate
  the safeguards a real model would need, not as evidence of real-world performance.

## License

Apache-2.0
