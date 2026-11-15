"""Three hand-written, fictional demo households for the CareTrail app.

Each one exercises specific rules from data/rules.json so that the demo
shows real behaviour rather than random output. Reference date: 2026-11-15.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def scr(last_done, result="normal", modality=None, referral=None, declined_on=None):
    return {"last_done": last_done, "modality": modality, "result": result if last_done else None,
            "referral": referral, "declined_on": declined_on}


NO_TOBACCO = {"status": "never", "types": [], "pack_years": 0, "water_pipe_years": 0, "years_since_quit": None}


def adult(pid, hh, role, sex, birth, **kw):
    base = {
        "id": pid, "household": hh, "role": role, "kind": "adult", "sex": sex, "birth_date": birth,
        "employment": "employed", "conditions": [], "family_history": [], "parents_related": False,
        "tobacco": NO_TOBACCO, "unwilling_colonoscopy_or_fit": False,
        "consent": {"program_screening": True, "genomic": False, "wearables": False, "share_with_household": True},
        "genomic_findings": [], "wearable": None, "married": True, "screening": {},
        "engagement": {"invites_3y": 2, "responded_3y": 1, "declined_12m": 0, "no_show_3y": 1},
    }
    base.update(kw)
    return base


def kid(pid, hh, name_sex, birth, attended, results=None, **kw):
    base = {
        "id": pid, "household": hh, "role": "child", "kind": "child", "sex": name_sex, "birth_date": birth,
        "premature": False, "newborn_hearing": "passed", "conditions": [],
        "consent": {"program_screening": True, "genomic": False, "wearables": False, "share_with_household": True},
        "wcv": {"attended_months": attended, "results": results or {}},
        "engagement": {"invites_3y": 3, "responded_3y": 3, "declined_12m": 0, "no_show_3y": 0},
    }
    base.update(kw)
    return base


DEMO = [
    {
        "id": "DEMO-1", "label": "Al Mansouri family", "national": True, "insurance": "Thiqa",
        "region": "Abu Dhabi City", "preferred_language": "ar", "preferred_channel": "app",
        "story": "Three generations. Mariam manages the family's health in the app.",
        "members": [
            adult("DEMO-1-01", "DEMO-1", "mother", "female", "1988-03-12", display_name="Mariam",
                  family_history=["cancer", "diabetes"],
                  consent={"program_screening": True, "genomic": False, "wearables": True, "share_with_household": True},
                  wearable={"steps_per_day": 4200, "sleep_hours": 5.8, "resting_hr": 74},
                  screening={"major": scr("2022-10-04"), "oral": scr("2025-12-02"),
                             "cervical_hpv": scr("2020-09-14"), "breast_cbe_gail": scr(None)}),
            adult("DEMO-1-02", "DEMO-1", "father", "male", "1981-06-02", display_name="Khalid",
                  conditions=["high_cholesterol"], family_history=["heart_disease"],
                  tobacco={"status": "current", "types": ["shisha"], "pack_years": 0, "water_pipe_years": 22, "years_since_quit": None},
                  consent={"program_screening": True, "genomic": True, "wearables": False, "share_with_household": True},
                  genomic_findings=["Familial hypercholesterolemia"],
                  screening={"major": scr("2026-10-20", "abnormal", referral={"made": False, "made_on": None, "completed": False, "completed_on": None}),
                             "vision": scr(None), "oral": scr("2024-03-11"),
                             "colorectal": scr("2025-09-20", modality="fit")}),
            adult("DEMO-1-03", "DEMO-1", "grandparent", "male", "1959-04-15", display_name="Saeed",
                  employment="retired", conditions=["hypertension", "diabetes"], preferred_channel="call",
                  tobacco={"status": "former", "types": ["cigarettes"], "pack_years": 35, "water_pipe_years": 0, "years_since_quit": 10},
                  screening={"major": scr("2025-01-15"), "vision": scr("2026-02-10"), "oral": scr("2026-05-03"),
                             "hearing_dementia_65_75": scr("2025-06-21"), "dexa": scr("2023-01-30"),
                             "colorectal": scr("2019-05-08", modality="colonoscopy"), "lung_ldct": scr(None), "aaa": scr(None)}),
            kid("DEMO-1-04", "DEMO-1", "female", "2025-05-10", [1, 2, 4, 6, 9, 12, 15], display_name="Salma",
                results={"cbc": {"hb_g_dl": 11.6, "done_on": "2026-05-14", "at_month": 12}}),
            kid("DEMO-1-05", "DEMO-1", "male", "2022-09-03", [1, 2, 4, 6, 9, 12, 15, 18, 24, 30, 36], display_name="Omar",
                conditions=["type1_diabetes"],
                results={"mchat_r_18": {"score": 1, "done_on": "2024-03-06"}, "mchat_r_24": {"score": 2, "done_on": "2024-09-09"},
                         "idaq_18": {"positive": False, "done_on": "2024-03-06"},
                         "cbc": {"hb_g_dl": 12.1, "done_on": "2023-09-10", "at_month": 12}}),
        ],
    },
    {
        "id": "DEMO-2", "label": "Khan family", "national": False, "insurance": "Basic",
        "region": "Al Ain", "preferred_language": "ur", "preferred_channel": "whatsapp",
        "story": "Expat family. Adults are outside IFHAS (Thiqa only); the toddler's referral is stuck.",
        "members": [
            adult("DEMO-2-01", "DEMO-2", "mother", "female", "1995-01-22", display_name="Ayesha", employment="homemaker"),
            adult("DEMO-2-02", "DEMO-2", "father", "male", "1990-08-30", display_name="Imran"),
            kid("DEMO-2-03", "DEMO-2", "male", "2024-11-12", [1, 2, 4, 6, 9, 12, 18], display_name="Zain",
                results={"mchat_r_18": {"score": 5, "done_on": "2026-05-15",
                                        "referral": {"made": True, "made_on": "2026-05-20", "completed": False, "completed_on": None}},
                         "idaq_18": {"positive": False, "done_on": "2026-05-15"},
                         "cbc": {"hb_g_dl": 11.4, "done_on": "2025-11-14", "at_month": 12}}),
        ],
    },
    {
        "id": "DEMO-3", "label": "Al Dhaheri family", "national": True, "insurance": "Thiqa",
        "region": "Al Dhafra", "preferred_language": "ar", "preferred_channel": "sms",
        "story": "Young couple with a newborn. Noura chose to postpone one screening; that choice is respected.",
        "members": [
            adult("DEMO-3-01", "DEMO-3", "mother", "female", "1999-07-19", display_name="Noura", employment="homemaker",
                  screening={"major": scr("2024-09-02"), "oral": scr("2025-03-17"), "cervical_pap": scr(None),
                             "breast_cbe": scr("2023-02-08"), "female_repro": scr("2023-06-12", declined_on="2026-08-03")}),
            adult("DEMO-3-02", "DEMO-3", "father", "male", "1997-02-11", display_name="Hamad",
                  tobacco={"status": "current", "types": ["midwakh_dokha"], "pack_years": 0, "water_pipe_years": 9, "years_since_quit": None},
                  screening={"major": scr(None), "male_repro": scr(None), "oral": scr("2022-11-30")}),
            kid("DEMO-3-03", "DEMO-3", "female", "2026-09-10", [1], display_name="Fatima", newborn_hearing="not_done"),
        ],
    },
]

if __name__ == "__main__":
    out = ROOT / "data" / "demo_families.json"
    out.write_text(json.dumps({"meta": {"synthetic": True, "reference_date": "2026-11-15"}, "households": DEMO},
                              ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", out, "with", sum(len(h["members"]) for h in DEMO), "people")
