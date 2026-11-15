"""CareTrail population analytics (synthetic data only).

1. Programme KPIs exactly as defined in the DoH standards (IFHAS App. 9, WCV 5.1).
2. An explainable outreach model: who is least likely to complete an overdue
   screening if only routinely invited. It is a population prioritisation aid,
   never shown to families and never a clinical decision.
3. Calibration and local-population safeguards by segment, with small-cell
   suppression.
4. A simulation comparing outreach policies under the same outreach capacity.

Writes data/dashboard.json for the program dashboard.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
RULES = json.loads((ROOT / "data" / "rules.json").read_text(encoding="utf-8"))
POP = json.loads((ROOT / "data" / "population.json").read_text(encoding="utf-8"))
ENG = json.loads((ROOT / "data" / "engine_population.json").read_text(encoding="utf-8"))
REF = date.fromisoformat(POP["meta"]["reference_date"])
SEED = 42
MIN_CELL = 10                 # small-cell suppression threshold
OUTREACH_CAPACITY = 0.30      # share of people with gaps who can get enhanced outreach
UPLIFT = 0.30                 # assumption: enhanced outreach removes 30% of non-completion
TIER_WEIGHT = {1: 3.0, 2: 2.0, 3: 1.0, 4: 1.0}

rows = ENG["rows"]
people = {m["id"]: (m, h) for h in POP["households"] for m in h["members"]}


def pct(a, b):
    return None if not b else round(100 * a / b, 1)


def suppress(n, value):
    return value if n >= MIN_CELL else None


# -- 1. KPIs ---------------------------------------------------------------------

def ifhas_kpis():
    out = []
    for pkg in RULES["ifhas"]["packages"]:
        eligible = completed = with_result = abnormal = referred_on_time = 0
        for r in rows:
            item = next((i for i in r["items"] if i["key"] == pkg["id"]), None)
            if not item or item["status"] in ("not_eligible", "uncertain"):
                continue
            eligible += 1
            if item["status"] in ("up_to_date", "due_soon", "open_loop"):
                completed += 1
                rec = people[r["id"]][0]["screening"].get(pkg["id"], {})
                if rec.get("result") in ("normal", "abnormal"):
                    with_result += 1
                if rec.get("result") == "abnormal":
                    abnormal += 1
                    ref = rec.get("referral") or {}
                    if ref.get("made") and ref.get("made_on"):
                        gap = (date.fromisoformat(ref["made_on"]) - date.fromisoformat(rec["last_done"])).days
                        referred_on_time += gap <= 21
        out.append({
            "package": pkg["id"], "name": pkg["name"], "eligible": eligible,
            "participation_pct": suppress(eligible, pct(completed, eligible)), "target_pct": 85,
            "abnormal_pct": suppress(with_result, pct(abnormal, with_result)),
            "referral_on_time_pct": suppress(abnormal, pct(referred_on_time, abnormal)), "referral_target_pct": 100,
            "abnormal_n": abnormal if abnormal >= MIN_CELL else None,
        })
    return out


def wcv_kpis():
    by_age = []
    kids = [(m, h) for (m, h) in people.values() if m["kind"] == "child"]
    for month in RULES["wcv"]["schedule_months"]:
        eligible = attended = 0
        for m, _ in kids:
            age_m = (REF - date.fromisoformat(m["birth_date"])).days / 30.44
            if age_m >= month + 1:  # past the visit age, so it could have been attended
                eligible += 1
                attended += month in m["wcv"]["attended_months"]
        by_age.append({"month": month, "eligible": eligible, "uptake_pct": suppress(eligible, pct(attended, eligible))})
    mchat = {}
    for month in (18, 24):
        att = [m for m, _ in kids if month in m["wcv"]["attended_months"]]
        done = [m for m in att if f"mchat_r_{month}" in m["wcv"]["results"]]
        abn = [m for m in done if m["wcv"]["results"][f"mchat_r_{month}"]["score"] >= 3]
        ref = [m for m in abn if (m["wcv"]["results"][f"mchat_r_{month}"].get("referral") or {}).get("made")]
        mchat[month] = {"attended": len(att), "uptake_pct": suppress(len(att), pct(len(done), len(att))), "target_pct": 100,
                        "abnormal_n": len(abn) if len(abn) >= MIN_CELL else None,
                        "referred_pct": suppress(len(abn), pct(len(ref), len(abn))), "referred_target_pct": 100}
    return {"uptake_by_age": by_age, "mchat_r": mchat}


# -- 2. outreach model -------------------------------------------------------------

def age_band(r):
    if r["kind"] == "child":
        return "child"
    a = r["age"]
    return "18-29" if a < 30 else "30-44" if a < 45 else "45-59" if a < 60 else "60-75"


FEATURES = [
    ("age_18_29", "Aged 18-29", lambda r: age_band(r) == "18-29"),
    ("age_60_75", "Aged 60-75", lambda r: age_band(r) == "60-75"),
    ("child", "Child (Well-Child programme)", lambda r: r["kind"] == "child"),
    ("male", "Male", lambda r: r["sex"] == "male" and r["kind"] == "adult"),
    ("employed", "In employment", lambda r: r["employment"] == "employed"),
    ("retired", "Retired", lambda r: r["employment"] == "retired"),
    ("al_ain", "Lives in Al Ain", lambda r: r["region"] == "Al Ain"),
    ("al_dhafra", "Lives in Al Dhafra", lambda r: r["region"] == "Al Dhafra"),
    ("lang_unsupported", "Preferred language not Arabic or English", lambda r: r["language"] not in ("ar", "en")),
    ("ch_sms", "Prefers SMS", lambda r: r["channel"] == "sms"),
    ("ch_whatsapp", "Prefers WhatsApp", lambda r: r["channel"] == "whatsapp"),
    ("ch_call", "Prefers phone calls", lambda r: r["channel"] == "call"),
    ("thiqa", "Thiqa member", lambda r: r["insurance"] == "Thiqa"),
    ("young_children", "Number of young children in household", lambda r: r["n_young_children"]),
    ("chronic", "Has a chronic condition", lambda r: r["n_conditions"] > 0),
    ("response_rate", "Past invitation response rate", lambda r: r["responded_3y"] / r["invites_3y"]),
    ("declined_12m", "Declines in the past 12 months", lambda r: r["declined_12m"]),
    ("no_show_3y", "Missed appointments in 3 years", lambda r: r["no_show_3y"]),
]


def matrix(rs):
    return np.array([[float(f(r)) for _, _, f in FEATURES] for r in rs])


def calibration(y, p, bins=10):
    edges = np.linspace(0, 1, bins + 1)
    out, ece = [], 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (p >= lo) & (p < hi if hi < 1 else p <= hi)
        n = int(mask.sum())
        if n == 0:
            continue
        mp, obs = float(p[mask].mean()), float(y[mask].mean())
        ece += n / len(y) * abs(mp - obs)
        out.append({"bin": f"{lo:.1f}-{hi:.1f}", "n": n, "mean_predicted": round(mp, 3),
                    "observed": round(obs, 3) if n >= MIN_CELL else None})
    return out, round(ece, 4)


def main():
    with_gaps = [r for r in rows if r["best_tier"]]
    scored = [r for r in with_gaps if r["invites_3y"] > 0]
    insufficient = [r for r in with_gaps if r["invites_3y"] == 0]

    X = matrix(scored)
    y = np.array([0 if r["completed_90d"] else 1 for r in scored])  # 1 = will not complete
    model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=1.0))
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    p_cv = cross_val_predict(model, X, y, cv=cv, method="predict_proba")[:, 1]
    model.fit(X, y)
    scaler, lr = model.named_steps["standardscaler"], model.named_steps["logisticregression"]
    calib, ece = calibration(y, p_cv)

    coefs = sorted(
        [{"feature": k, "label": lab, "coef": round(float(c), 3)} for (k, lab, _), c in zip(FEATURES, lr.coef_[0])],
        key=lambda x: -abs(x["coef"]),
    )

    def contributions(xrow):
        z = (xrow - scaler.mean_) / scaler.scale_
        parts = [(FEATURES[j][1], float(lr.coef_[0][j] * z[j])) for j in range(len(FEATURES))]
        return [{"label": lab, "effect": round(v, 3)} for lab, v in sorted(parts, key=lambda t: -t[1])[:3] if v > 0]

    # Predicted non-completion is used only to order people within the same clinical tier.
    for r, p in zip(scored, p_cv):
        r["p_noncomplete"] = float(p)
    mean_risk = float(p_cv.mean())
    for r in insufficient:
        r["p_noncomplete"] = mean_risk  # no history: neutral, prioritised on clinical tier only
        r["insufficient_history"] = True
    for r in with_gaps:
        r["priority"] = TIER_WEIGHT[r["best_tier"]] * r["p_noncomplete"]

    k = int(round(OUTREACH_CAPACITY * len(with_gaps)))
    rng = np.random.default_rng(SEED)
    policies = {
        "Broad invitation (random order)": list(rng.permutation(len(with_gaps))[:k]),
        "Age-first rule (oldest first)": list(np.argsort([-r["age"] if r["kind"] == "adult" else 0 for r in with_gaps])[:k]),
        "Clinical tier only (no model)": list(np.lexsort((rng.random(len(with_gaps)), [r["best_tier"] for r in with_gaps]))[:k]),
        # Clinical urgency decides the order; the model only ranks people within the same tier.
        "CareTrail prioritisation": list(np.lexsort(([-r["p_noncomplete"] for r in with_gaps], [r["best_tier"] for r in with_gaps]))[:k]),
    }
    sim = []
    for name, idx in policies.items():
        chosen = set(int(i) for i in idx)
        exp_done = w_done = loops_closed = 0.0
        for i, r in enumerate(with_gaps):
            p = r["p_true"] + (UPLIFT * (1 - r["p_true"]) if i in chosen else 0)
            exp_done += p
            w_done += TIER_WEIGHT[r["best_tier"]] * p
            loops_closed += p if r["n_open_loops"] else 0
        sim.append({"policy": name, "contacted": len(chosen), "expected_completions": round(exp_done),
                    "clinically_weighted": round(w_done), "expected_open_loops_closed": round(loops_closed)})
    base = sim[0]
    for s in sim:
        s["gain_vs_broad"] = s["expected_completions"] - base["expected_completions"]
        s["weighted_gain_vs_broad"] = s["clinically_weighted"] - base["clinically_weighted"]
        s["open_loops_gain_vs_broad"] = s["expected_open_loops_closed"] - base["expected_open_loops_closed"]

    # 3. safeguards by segment (CareTrail policy flag = selected for enhanced outreach)
    flagged = set(int(i) for i in policies["CareTrail prioritisation"])
    segments = {
        "Sex (adults)": lambda r: (r["sex"] if r["kind"] == "adult" else None),
        "Age band": age_band,
        "Nationality": lambda r: "UAE national" if r["national"] else "Expatriate",
        "Region": lambda r: r["region"],
        "Preferred language": lambda r: {"ar": "Arabic", "en": "English"}.get(r["language"], "Other"),
    }
    safeguards = []
    for seg, fn in segments.items():
        groups = defaultdict(list)
        for i, r in enumerate(with_gaps):
            g = fn(r)
            if g is not None:
                groups[g].append((i, r))
        for g, members in sorted(groups.items()):
            n = len(members)
            sel = [r for i, r in members if i in flagged]
            completers = [(i, r) for i, r in members if r["completed_90d"]]
            non = [(i, r) for i, r in members if not r["completed_90d"]]
            fp = sum(1 for i, _ in completers if i in flagged)
            fn_ = sum(1 for i, _ in non if i not in flagged)
            obs_non = len(non) / n if n else 0
            pred_non = float(np.mean([r["p_noncomplete"] for _, r in members])) if n else 0
            safeguards.append({
                "segment": seg, "group": g, "n": n if n >= MIN_CELL else None,
                "recommended_pct": suppress(n, pct(len(sel), n)),
                "baseline_uptake_pct": suppress(n, pct(len(completers), n)),
                "false_positive_pct": suppress(len(completers), pct(fp, len(completers))),
                "false_negative_pct": suppress(len(non), pct(fn_, len(non))),
                "calibration_gap_pts": suppress(n, round(100 * (pred_non - obs_non), 1)),
                "needs_local_recalibration": n >= MIN_CELL and abs(100 * (pred_non - obs_non)) > 5,
                "suppressed": n < MIN_CELL,
            })

    # sample outreach queue (pseudonymous, explainable)
    order = np.lexsort(([-r["p_noncomplete"] for r in with_gaps], [r["best_tier"] for r in with_gaps]))[:12]
    idx_scored = {r["id"]: j for j, r in enumerate(scored)}
    queue = []
    for i in order:
        r = with_gaps[int(i)]
        gaps = [it for it in r["items"] if it["tier"] and it["tier"] <= 4]
        queue.append({
            "pseudonym": f"P-{abs(hash(r['id'])) % 100000:05d}", "tier": r["best_tier"],
            "gaps": sorted({it["key"] for it in gaps})[:4],
            "predicted_noncompletion_pct": round(100 * r["p_noncomplete"]),
            "drivers": [] if r.get("insufficient_history") else contributions(X[idx_scored[r["id"]]]),
            "insufficient_history": bool(r.get("insufficient_history")),
            "suggested_channel": r["channel"], "suggested_language": r["language"],
            "interpreter_needed": r["language"] not in ("ar", "en"),
        })

    tiers = {f"T{t}": sum(1 for r in with_gaps if r["best_tier"] == t) for t in (1, 2, 3, 4)}
    out = {
        "meta": {"synthetic": True, "reference_date": POP["meta"]["reference_date"], "people": len(rows),
                 "households": POP["meta"]["households"], "min_cell": MIN_CELL,
                 "outreach_capacity_pct": int(OUTREACH_CAPACITY * 100), "uplift_assumption_pct": int(UPLIFT * 100)},
        "care_gaps": {"people_with_gaps": len(with_gaps), "by_tier": tiers,
                      "people_with_open_loops": sum(1 for r in with_gaps if r["n_open_loops"])},
        "kpis": {"ifhas": ifhas_kpis(), "wcv": wcv_kpis()},
        "model": {
            "purpose": "Population outreach prioritisation only. Not shown to families; not a clinical decision.",
            "type": "Logistic regression, standardised features", "target": "Does not complete within 90 days of routine invitation",
            "n_scored": len(scored), "n_insufficient_history": len(insufficient),
            "auc": round(float(roc_auc_score(y, p_cv)), 3), "brier": round(float(brier_score_loss(y, p_cv)), 4),
            "ece": ece, "calibration": calib, "coefficients": coefs,
            "validation": "5-fold cross-validated predictions on synthetic data",
        },
        "simulation": sim,
        "safeguards": safeguards,
        "queue": queue,
        "assumptions": [
            "All data are synthetic; prevalences are illustrative, not estimates of the Abu Dhabi population.",
            f"Enhanced outreach (personal contact in the preferred language and channel, with booking) is assumed to remove {int(UPLIFT*100)}% of non-completion.",
            f"Outreach capacity is fixed at {int(OUTREACH_CAPACITY*100)}% of people with care gaps for every policy.",
            f"Cells with fewer than {MIN_CELL} people are suppressed; people without invitation history are not scored by the model.",
            "Clinical weights: open loop or recall 3, higher-priority overdue 2, other overdue or due 1.",
        ],
    }
    (ROOT / "data" / "dashboard.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: out["model"][k] for k in ("n_scored", "n_insufficient_history", "auc", "brier", "ece")}))
    for s in sim:
        print(s)
    print("care gaps:", out["care_gaps"])


if __name__ == "__main__":
    main()
