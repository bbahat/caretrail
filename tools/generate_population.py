"""Generate a synthetic Abu Dhabi-style family population for CareTrail.

Everything here is synthetic. No real person, record or statistic is used;
prevalence values are illustrative placeholders chosen to exercise the
screening rules, not estimates of the real population.

Outputs
  data/population.json   all households (input to the engine and the model)
  data/demo_families.json  three hand-written demo households for the app
"""

from __future__ import annotations

import json
import math
import random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES = json.loads((ROOT / "data" / "rules.json").read_text(encoding="utf-8"))
REF_DATE = date(2026, 11, 15)  # fixed "today" so every run is reproducible
SEED = 42
N_HOUSEHOLDS = 1500

rng = random.Random(SEED)


# -- small helpers -----------------------------------------------------------

def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def iso(d: date | None) -> str | None:
    return d.isoformat() if d else None


def years_ago(y: float) -> date:
    return REF_DATE - timedelta(days=int(y * 365.25))


def birth_for_age_years(age: float) -> date:
    return years_ago(age + rng.random() * 0.9)


def birth_for_age_months(months: float) -> date:
    return REF_DATE - timedelta(days=int(months * 30.44))


def age_years(birth: date) -> float:
    return (REF_DATE - birth).days / 365.25


def age_months(birth: date) -> float:
    return (REF_DATE - birth).days / 30.44


def chance(p: float) -> bool:
    return rng.random() < p


def pick(options: dict):
    r, acc = rng.random(), 0.0
    for value, p in options.items():
        acc += p
        if r < acc:
            return value
    return list(options)[-1]


# -- people ---------------------------------------------------------------------

REGIONS = {"Abu Dhabi City": 0.6, "Al Ain": 0.3, "Al Dhafra": 0.1}
CHANNELS = {"app": 0.45, "sms": 0.25, "whatsapp": 0.2, "call": 0.1}


def make_household(hid: int) -> dict:
    national = chance(0.6)
    if national:
        language = pick({"ar": 0.85, "en": 0.15})
        insurance = "Thiqa"
    else:
        language = pick({"en": 0.6, "ar": 0.2, "ur": 0.1, "tl": 0.1})
        insurance = pick({"Basic": 0.5, "Enhanced": 0.5})
    return {
        "id": f"H{hid:05d}",
        "national": national,
        "insurance": insurance,
        "region": pick(REGIONS),
        "preferred_language": language,
        "preferred_channel": pick(CHANNELS),
        "members": [],
    }


def adult(hh: dict, pid: str, sex: str, age: float, role: str) -> dict:
    a = round(age)
    p_obese = 0.25 + 0.002 * a
    p_dm = min(0.04 + 0.004 * max(a - 25, 0), 0.35)
    p_htn = min(0.03 + 0.006 * max(a - 25, 0), 0.5)
    p_chol = min(0.08 + 0.005 * max(a - 25, 0), 0.45)
    smoker_p = 0.25 if sex == "male" else 0.05
    status = pick({"current": smoker_p, "former": smoker_p * 0.5, "never": 1 - smoker_p * 1.5})
    tobacco = {"status": status, "types": [], "pack_years": 0, "water_pipe_years": 0, "years_since_quit": None}
    if status != "never":
        tobacco["types"] = rng.sample(["cigarettes", "shisha", "midwakh_dokha", "e_cigarettes"], k=rng.choice([1, 1, 2]))
        smoking_years = max(1, a - rng.randint(16, 25))
        if "cigarettes" in tobacco["types"]:
            tobacco["pack_years"] = round(smoking_years * rng.uniform(0.3, 1.5), 1)
        if {"shisha", "midwakh_dokha"} & set(tobacco["types"]):
            tobacco["water_pipe_years"] = smoking_years
        if status == "former":
            tobacco["years_since_quit"] = rng.randint(1, 25)
    employment = pick({"employed": 0.6, "homemaker": 0.15, "student": 0.05, "retired": 0.1, "unemployed": 0.1})
    if a >= 62:
        employment = pick({"retired": 0.75, "employed": 0.2, "homemaker": 0.05})
    if a <= 22:
        employment = pick({"student": 0.7, "employed": 0.3})
    consented_genomic = chance(0.25)
    genomic = []
    if consented_genomic:
        if sex == "female" and chance(0.02):
            genomic.append("BRCA1/2 pathogenic variant")
        if chance(0.006):
            genomic.append("Lynch syndrome")
        if chance(0.008):
            genomic.append("Familial hypercholesterolemia")
    wearable = None
    if chance(0.35):
        wearable = {
            "steps_per_day": int(max(1500, rng.gauss(6500, 2500))),
            "sleep_hours": round(min(9.5, max(4.0, rng.gauss(6.6, 1.0))), 1),
            "resting_hr": int(min(100, max(50, rng.gauss(70, 8)))),
        }
    return {
        "id": pid,
        "household": hh["id"],
        "role": role,
        "kind": "adult",
        "sex": sex,
        "birth_date": iso(birth_for_age_years(age)),
        "employment": employment,
        "conditions": [c for c, p in [("obesity", p_obese), ("diabetes", p_dm), ("hypertension", p_htn), ("high_cholesterol", p_chol), ("copd", 0.01 + (0.05 if status != "never" else 0))] if chance(p)],
        "family_history": [c for c, p in [("diabetes", 0.35), ("hypertension", 0.35), ("heart_disease", 0.15), ("cancer", 0.12), ("osteoporosis", 0.08)] if chance(p)],
        "parents_related": (chance(0.35) if hh["national"] else chance(0.08)),
        "tobacco": tobacco,
        "unwilling_colonoscopy_or_fit": chance(0.05),
        "consent": {
            "program_screening": True,
            "genomic": consented_genomic,
            "wearables": wearable is not None,
            "share_with_household": chance(0.8),
        },
        "genomic_findings": genomic,
        "wearable": wearable,
        "married": role in ("mother", "father", "grandparent", "grandmother"),
        "screening": {},
        "engagement": {},
    }


def child(hh: dict, pid: str, months: float) -> dict:
    sex = pick({"female": 0.5, "male": 0.5})
    return {
        "id": pid,
        "household": hh["id"],
        "role": "child",
        "kind": "child",
        "sex": sex,
        "birth_date": iso(birth_for_age_months(months)),
        "premature": chance(0.09),
        "newborn_hearing": pick({"passed": 0.96, "not_done": 0.03, "failed": 0.01}),
        "conditions": [c for c, p in [("type1_diabetes", 0.003), ("obesity", 0.05)] if chance(p)],
        "consent": {"program_screening": True, "genomic": False, "wearables": False, "share_with_household": True},
        "wcv": {"attended_months": [], "results": {}},
        "engagement": {},
    }


# -- screening history -----------------------------------------------------------

ABNORMAL_RATE = {
    "major": 0.25, "vision": 0.08, "hearing_dementia_50_64": 0.07, "hearing_dementia_65_75": 0.12,
    "oral": 0.2, "cervical_pap": 0.05, "cervical_hpv": 0.07, "breast_cbe": 0.03, "breast_cbe_gail": 0.05,
    "mammography": 0.08, "female_repro": 0.12, "male_repro": 0.06, "colorectal": 0.06, "dexa": 0.15,
    "lung_ldct": 0.1, "aaa": 0.03,
}


def lung_high_risk(p: dict) -> bool:
    """IFHAS App. 7 criteria. 'Additional risk factor' is defined by CareTrail as
    COPD or a family history of cancer (the referenced DoH lung specification is
    not part of the two standards used here)."""
    t = p["tobacco"]
    quit_ok = t["status"] == "current" or (t["years_since_quit"] is not None and t["years_since_quit"] < 15)
    extra = "copd" in p["conditions"] or "cancer" in p["family_history"]
    return (t["pack_years"] >= 30 and quit_ok) or t["water_pipe_years"] >= 20 or (t["pack_years"] >= 20 and quit_ok and extra)


def eligible_packages(p: dict, hh: dict) -> list[dict]:
    if hh["insurance"] != "Thiqa":
        return []
    a = age_years(date.fromisoformat(p["birth_date"]))
    out = []
    for pkg in RULES["ifhas"]["packages"]:
        lo, hi = pkg["age"]
        if not (lo <= a < hi + 1):
            continue
        if pkg["sex"] != "any" and pkg["sex"] != p["sex"]:
            continue
        if pkg["id"] == "lung_ldct" and not lung_high_risk(p):
            continue
        if pkg["id"] == "aaa" and p["tobacco"]["status"] == "never":
            continue
        out.append(pkg)
    return out


def interval_of(pkg: dict, modality: str | None = None) -> float:
    if pkg["id"] == "colorectal":
        return next(o["interval_years"] for o in pkg["options"] if o["id"] == modality)
    if pkg.get("once_in_lifetime"):
        return 999.0
    return pkg["interval_years"]


def simulate_adult_history(p: dict, hh: dict, propensity: float) -> None:
    for pkg in eligible_packages(p, hh):
        modality = None
        if pkg["id"] == "colorectal":
            modality = "liquid_biopsy" if p["unwilling_colonoscopy_or_fit"] else pick({"fit": 0.72, "colonoscopy": 0.28})
        interval = interval_of(pkg, modality)
        up_to_date = chance(sigmoid(propensity + 0.4))
        if up_to_date:
            span = min(interval, 6)
            last = years_ago(rng.uniform(0.05, span * 0.98))
        elif chance(0.25):
            last = None  # never screened
        else:
            last = years_ago(min(interval, 6) + rng.uniform(0.1, 4))
        rec = {"last_done": iso(last), "modality": modality, "result": None, "referral": None}
        if last:
            if chance(0.03):
                rec["result"] = "insufficient"
            elif chance(ABNORMAL_RATE.get(pkg["id"], 0.05)):
                rec["result"] = "abnormal"
                referred = chance(0.8)
                completed = referred and chance(sigmoid(propensity + 0.8))
                ref_date = last + timedelta(days=rng.randint(5, 30)) if referred else None
                rec["referral"] = {
                    "made": referred,
                    "made_on": iso(ref_date),
                    "completed": completed,
                    "completed_on": iso(ref_date + timedelta(days=rng.randint(10, 60))) if completed else None,
                }
            else:
                rec["result"] = "normal"
        p["screening"][pkg["id"]] = rec


def simulate_child_history(c: dict, propensity: float) -> None:
    m_now = age_months(date.fromisoformat(c["birth_date"]))
    birth = date.fromisoformat(c["birth_date"])
    for m in RULES["wcv"]["schedule_months"]:
        if m > m_now:
            break
        if chance(sigmoid(propensity + 1.3)):
            c["wcv"]["attended_months"].append(m)
    attended = set(c["wcv"]["attended_months"])
    res = c["wcv"]["results"]

    def visit_date(m):
        return birth + timedelta(days=int(m * 30.44) + rng.randint(0, 20))

    def referral(at_month, p_complete_bias=0.6):
        made = chance(0.85)
        made_on = visit_date(at_month) + timedelta(days=rng.randint(1, 14)) if made else None
        done = made and chance(sigmoid(propensity + p_complete_bias))
        return {"made": made, "made_on": iso(made_on), "completed": done,
                "completed_on": iso(made_on + timedelta(days=rng.randint(10, 40))) if done else None}

    for m in (18, 24):
        if m in attended:
            score = pick({rng.randint(0, 2): 0.85, rng.randint(3, 7): 0.12, rng.randint(8, 20): 0.03})
            r = {"score": score, "done_on": iso(visit_date(m))}
            if score >= 3:
                r["referral"] = referral(m)
            res[f"mchat_r_{m}"] = r
    if 18 in attended:
        positive = chance(0.08)
        r = {"positive": positive, "done_on": iso(visit_date(18))}
        if positive:
            r["referral"] = referral(18)
        res["idaq_18"] = r
    cbc_month = next((m for m in (12, 15, 18) if m in attended and chance(0.85)), None)
    if cbc_month:
        hb = round(rng.gauss(11.9, 0.9), 1)
        r = {"hb_g_dl": hb, "done_on": iso(visit_date(cbc_month)), "at_month": cbc_month}
        if hb < 11:
            r["referral"] = referral(cbc_month)
        res["cbc"] = r
    for m in (48, 60, 72):
        if m in attended:
            passed = chance(0.95)
            r = {"passed": passed, "done_on": iso(visit_date(m))}
            if not passed:
                r["referral"] = referral(m)
            res[f"hearing_pta_{m}"] = r


# -- engagement and the outcome the model will learn -----------------------------

def attendance_propensity(p: dict, hh: dict, n_young_children: int) -> float:
    """Latent willingness to attend if invited (never shown; used to simulate)."""
    x = 0.3
    if p["kind"] == "adult":
        a = age_years(date.fromisoformat(p["birth_date"]))
        x += {"employed": -0.35, "student": -0.2, "retired": 0.45, "homemaker": 0.15, "unemployed": -0.1}[p["employment"]]
        x += -0.35 if p["sex"] == "male" else 0.0
        x += -0.3 if a < 30 else 0.0
        x += -0.2 * max(n_young_children - 1, 0)
        x += 0.25 if p["conditions"] else 0.0
    x += {"Abu Dhabi City": 0.2, "Al Ain": 0.0, "Al Dhafra": -0.5}[hh["region"]]
    x += -0.8 if hh["preferred_language"] not in ("ar", "en") else 0.0
    x += 0.2 if hh["preferred_channel"] == "app" else 0.0
    x += 0.25 if hh["insurance"] == "Thiqa" else -0.1
    return x + rng.gauss(0, 0.6)


def simulate_engagement(p: dict, propensity: float) -> None:
    invites = rng.choice([0, 0] + list(range(1, 7)))  # some people have no invitation history
    responded = sum(chance(sigmoid(propensity)) for _ in range(invites))
    declines = sum(chance(0.15 * (1 - sigmoid(propensity))) for _ in range(invites))
    p["engagement"] = {
        "invites_3y": invites,
        "responded_3y": responded,
        "declined_12m": min(declines, invites - responded),
        "no_show_3y": max(0, invites - responded - declines),
    }
    # Ground truth for evaluation only (never shown in the app):
    # probability and outcome of completing within 90 days if invited now.
    p_true = sigmoid(propensity - 0.2)
    p["_p_complete_90d"] = round(p_true, 4)
    p["_outcome_completes_90d"] = chance(p_true)


# -- build ----------------------------------------------------------------------

def build_population() -> list[dict]:
    households = []
    for h in range(N_HOUSEHOLDS):
        hh = make_household(h)
        pid = 0

        def nid():
            nonlocal pid
            pid += 1
            return f"{hh['id']}-{pid:02d}"

        mother_age = rng.uniform(20, 48)
        hh["members"].append(adult(hh, nid(), "female", mother_age, "mother"))
        if chance(0.88):
            hh["members"].append(adult(hh, nid(), "male", min(75, mother_age + rng.uniform(-2, 9)), "father"))
        if chance(0.18):
            hh["members"].append(adult(hh, nid(), pick({"female": 0.55, "male": 0.45}), rng.uniform(58, 75), "grandparent"))
        n_young = 0
        if mother_age < 44:
            for _ in range(pick({0: 0.35, 1: 0.4, 2: 0.2, 3: 0.05})):
                hh["members"].append(child(hh, nid(), rng.uniform(1, 72)))
                n_young += 1
        for p in hh["members"]:
            prop = attendance_propensity(p, hh, n_young)
            if p["kind"] == "adult":
                simulate_adult_history(p, hh, prop)
            else:
                simulate_child_history(p, prop)
            simulate_engagement(p, prop)
        households.append(hh)
    return households


def main() -> None:
    pop = build_population()
    (ROOT / "data" / "population.json").write_text(json.dumps(
        {"meta": {"synthetic": True, "seed": SEED, "reference_date": REF_DATE.isoformat(), "households": len(pop)},
         "households": pop}, ensure_ascii=False), encoding="utf-8")
    people = [m for h in pop for m in h["members"]]
    adults = [m for m in people if m["kind"] == "adult"]
    kids = [m for m in people if m["kind"] == "child"]
    print(f"households={len(pop)} people={len(people)} adults={len(adults)} children={len(kids)}")
    print(f"thiqa households={sum(h['insurance']=='Thiqa' for h in pop)}")
    print(f"genomic findings={sum(bool(a['genomic_findings']) for a in adults)}")
    print(f"open adult loops={sum(1 for a in adults for r in a['screening'].values() if r['referral'] and not r['referral']['completed'])}")


if __name__ == "__main__":
    main()
