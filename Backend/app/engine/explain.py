"""Plain-language explanations: input → risk → requirement → filter → selection.

Only numbers that also appear in the response payload are quoted.
"""
from __future__ import annotations

from .context import Scenario
from .evaluate import Evaluation, pct, sig, window_text
from .requirements import Requirements
from .shelf_life import round_days
from .types import PROV_SOURCE

PRIORITY_LABELS = {"shelfLife": "shelf life", "cost": "cost", "sustainability": "sustainability",
                   "mechanicalStrength": "mechanical strength"}


def _days(d: float) -> str:
    return f"{round_days(d):g}"


def why(sc: Scenario, req: Requirements, rec: Evaluation, rejected: list[dict], fallback: bool) -> list[str]:
    lines: list[str] = []
    codes = {r.code for r in req.risks}
    fat = sc.v("fatPct") or 0
    moisture = sc.v("moisturePct") or 0

    if req.produce:
        p = req.produce
        resp = sc.v("respirationClass") or "medium"
        lines.append(
            f"{resp.capitalize()} respiration (about {p.rate_nom:.0f} mL O₂/kg·h at {sc.temperature_c:g} °C) means the "
            f"{sc.pack_mass_g:g} g pack must let in roughly {sig(rec.gas['o2SupplyNeededMlDay'])} mL O₂ a day, "
            "so gas exchange has to be engineered rather than blocked."
        )
        perf = rec.perforation
        if perf and perf["type"] == "micro" and perf["required"]:
            lines.append(
                f"{perf['holesPerPack']} laser micro-perforations of {perf['diameterUm']} µm hold O₂ near {pct(rec.gas['o2'])} "
                f"(CO₂ near {pct(rec.gas['co2'])}) at storage, and above {pct(rec.gas['o2Worst'])} during a "
                f"{rec.gas['worstCaseC']:g} °C transit excursion, clear of the anaerobic point."
            )
        if p.o2_window and p.window_provenance == PROV_SOURCE:
            lines.append(
                f"The target atmosphere (O₂ {window_text(p.o2_window)}"
                + (f", CO₂ {window_text(p.co2_window)}" if p.co2_window else "")
                + f") is the published recommendation for {sc.name.lower()}."
            )
        if req.anti_fog:
            lines.append(f"{sc.rh * 100:.0f} % RH with cold-chain temperature swings risks condensation, so the inner surface must be anti-fog.")
        lines.extend(req.notes)
    else:
        if req.moisture_mode == "gain" and req.wvtr_max_test is not None:
            lines.append(
                f"Water activity {sc.aw:.2f} against {sc.rh * 100:.0f} % RH outside means the product gains moisture and loses "
                f"quality at aw {sc.v('awCritical'):.2f}, so WVTR must stay at or below {sig(req.wvtr_max_test)} g/m²·day "
                f"(38 °C, 90 % RH) for {sc.target_days} days."
            )
        elif req.moisture_mode == "loss" and req.wvtr_max_test is not None:
            lines.append(
                f"The product (aw {sc.aw:.2f}) dries out at {sc.rh * 100:.0f} % RH, so WVTR must stay at or below "
                f"{sig(req.wvtr_max_test)} g/m²·day to limit weight loss to {req.allowed_loss_frac * 100:g} %."
            )
        if req.otr_max_test is not None:
            lines.append(
                f"{fat:g} % fat with {sc.v('oxidationSensitivity')} oxidation sensitivity tolerates about "
                f"{req.o2_budget_mg_per_kg:g} mg O₂/kg, so OTR must stay at or below {sig(req.otr_max_test)} cc/m²·day·atm "
                f"(23 °C) for {sc.target_days} days."
            )
        if req.light:
            lines.append("Fat plus light sensitivity makes photo-oxidation likely, so an opaque or metallised layer is required.")
        if "MICROBIAL" in codes:
            tail = f"{req.map_label.split(',')[0]} in a hermetic barrier pack" if req.map_label else "A barrier pack"
            lines.append(
                f"Water activity {sc.aw:.2f} at {sc.temperature_c:g} °C supports microbial growth. {tail} slows spoilage, "
                "but the cold chain stays essential."
            )
        if req.contamination_tolerant:
            what = f"{fat:g} % fat" if fat > 15 else f"{moisture:g} % moisture"
            lines.append(f"{what} can contaminate the seal jaws, so the sealant must seal through contamination (mLLDPE or ionomer).")

    if any("Gelbo" in r for item in rejected for r in item["reasons"]):
        lines.append(
            f"{sc.transport_stress.capitalize()} transport stress allows at most {req.max_pinholes:g} Gelbo flex pinholes, "
            "which rules out the more crack-prone barrier laminates."
        )

    top = sorted(sc.priorities.items(), key=lambda kv: -kv[1])[:2]
    prio = " and ".join(PRIORITY_LABELS[k] for k, _ in top)
    s = rec.shelf
    if fallback:
        lines.append(
            f"No candidate met every constraint and your {sc.target_days}-day target, so {rec.structure.name} is the "
            f"closest option (estimated {_days(s.low)}–{_days(s.high)} days). Review the flagged requirements."
        )
    else:
        lines.append(
            f"{rec.structure.name} passes every hard constraint and gives the best balance for your priorities ({prio}): "
            f"estimated shelf life {_days(s.low)}–{_days(s.high)} days against your {sc.target_days}-day target, "
            f"at about ₹{rec.footprint.inr_per_pack:.2f} per pack."
        )
    # Keep the selection sentence; trim drivers to fit six lines.
    return lines[:5] + [lines[-1]] if len(lines) > 6 else lines


def tradeoff(alt: Evaluation, rec: Evaluation, profile: str, target: int) -> str:
    parts: list[str] = []
    a, r = alt.footprint, rec.footprint
    if r.inr_per_pack > 0:
        delta = (a.inr_per_pack - r.inr_per_pack) / r.inr_per_pack
        if abs(delta) >= 0.05:
            parts.append(f"≈{abs(delta) * 100:.0f} % {'lower' if delta < 0 else 'higher'} cost (₹{a.inr_per_pack:.2f} vs ₹{r.inr_per_pack:.2f} per pack)")
    sa, sr = alt.shelf.estimate, rec.shelf.estimate
    if alt.shelf.estimate < target:
        parts.append(f"below your {target}-day target (estimated {_days(sa)} days, limited by {alt.shelf.failure_mode})")
    elif abs(sa - sr) / max(sr, 1) >= 0.1:
        parts.append(f"estimated shelf life {_days(sa)} vs {_days(sr)} days")
    if a.recyclable and not r.recyclable:
        parts.append("recyclable mono-material")
    elif a.epr_category != r.epr_category:
        parts.append(f"EPR Category {a.epr_category} instead of {r.epr_category}")
    elif r.g_co2e > 0 and abs(a.g_co2e - r.g_co2e) / r.g_co2e >= 0.15:
        parts.append(f"{'lower' if a.g_co2e < r.g_co2e else 'higher'} footprint ({a.g_co2e:.0f} vs {r.g_co2e:.0f} g CO₂e)")
    failing = [row["label"] for row in alt.rows if row["status"] != "PASS"]
    if failing:
        parts.append("needs review on " + ", ".join(failing[:3]).lower())
    body = "; ".join(parts) if parts else "similar performance at a similar cost"
    return f"{profile}: {body[0].upper()}{body[1:]}."
