"""Layer 2: how one candidate structure performs against the derived requirements.

Shared by /api/analyze (every library structure) and /api/evaluate (a user-built stack).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from . import physics as ph
from .context import Scenario
from .gatekeeper import structure_pinholes
from .lca_cost import Footprint, footprint
from .requirements import Requirements, window_provenance
from .shelf_life import ShelfLife, barrier_life, produce_life
from .types import PROV_PROTO, PROV_RULE, SEAL_RANK, StructureSpec

MICRO_DIAMETERS_UM = (60, 80, 100, 150, 200)
MAX_MICRO_HOLES = 40
MACRO = {"diameterUm": 5000, "holes": 8}
MARGIN = 0.8  # PASS needs 20 % headroom against a numeric target

SHORT = {
    "BOPET": "PET", "MET_PET": "Met-PET", "AL_FOIL": "Al", "EVOH_COEX": "PE-EVOH-PE", "MLLDPE": "mLLDPE",
    "ANTIFOG_LDPE": "AF-LDPE", "ANTIFOG_BOPP": "AF-BOPP", "MET_BOPP": "Met-BOPP", "COATED_BOPP": "coated BOPP",
    "PBS_PHA": "PBS/PHA", "IONOMER": "ionomer",
}
ROLES = {
    "print": "Strength, stiffness and printing support",
    "structural": "Puncture and flex-crack resistance",
    "barrier": "Gas and moisture barrier",
    "seal": "Heat-seal layer",
}


def sig(x: float, n: int = 2) -> str:
    """Round to n significant figures: no fake precision."""
    if x is None or not math.isfinite(x):
        return "∞"
    if x == 0:
        return "0"
    digits = n - 1 - math.floor(math.log10(abs(x)))
    r = round(x, digits)
    if abs(r) >= 1000:
        return f"{r:,.0f}"
    return f"{r:.{max(0, digits)}f}"


def pct(fraction: float) -> str:
    return f"{fraction * 100:.0f} %" if fraction >= 0.1 else f"{fraction * 100:.1f} %"


def window_text(w: tuple[float, float]) -> str:
    return f"{w[0] * 100:g}–{w[1] * 100:g} %"


@dataclass
class Evaluation:
    structure: StructureSpec
    otr_t: float
    otr_test: float
    wvtr_test: float
    k_t: float
    perforation: dict | None
    gas: dict | None
    shelf: ShelfLife
    footprint: Footprint
    mech_index: float
    pinholes: float
    light_ok: bool
    seal_ok: bool
    map_capable: bool
    target_days: float = 0.0
    rows: list[dict] = field(default_factory=list)
    violations: list[str] = field(default_factory=list)

    @property
    def meets_target(self) -> bool:
        return self.shelf.estimate >= self.target_days


def mechanical_index(s: StructureSpec) -> float:
    return min(100.0, sum(l.thickness_um * l.material.toughness for l in s.layers) / 2)


def map_capable(s: StructureSpec, otr_test: float) -> bool:
    return s.gas_mode == "barrier" and otr_test <= 100 and SEAL_RANK[s.seal_layer.material.sealability] >= 2


def _design_perforation(s: StructureSpec, sc: Scenario, req: Requirements) -> tuple[dict | None, dict]:
    p = req.produce
    area = sc.pack_area_m2
    film = s.total_gauge_um
    rh_in = 0.95
    g_film = ph.structure_otr(s, sc.temperature_c, rh_in) * area
    g_film_w = ph.structure_otr(s, sc.worst_case_c, rh_in) * area
    beta = s.seal_layer.material.prop("permselectivity", ph.DEFAULT_PERMSELECTIVITY)

    perf = None
    n, d = 0, None
    if s.perforation == "micro":
        for d_try in MICRO_DIAMETERS_UM:
            g_nom = ph.hole_conductance(d_try, film, sc.temperature_c)
            g_w = ph.hole_conductance(d_try, film, sc.worst_case_c)
            need = max(ph.holes_needed(p.demand_nom, p.y_target, g_film, g_nom),
                       ph.holes_needed(p.demand_worst, p.y_min, g_film_w, g_w))
            n, d = math.ceil(need), d_try
            if n <= MAX_MICRO_HOLES:
                break
        perf = {"type": "micro", "required": n > 0, "diameterUm": d if n > 0 else None, "holesPerPack": n,
                "standard": "Laser micro-perforation; verify hole diameters by SEM / OTR test (ASTM D3985)",
                "provenance": PROV_RULE}
    elif s.perforation == "macro":
        n, d = MACRO["holes"], MACRO["diameterUm"]
        perf = {"type": "macro", "required": True, "diameterUm": d, "holesPerPack": n,
                "standard": "Mechanical vent holes", "provenance": PROV_PROTO}

    g_hole = ph.hole_conductance(d, film, sc.temperature_c) if n else 0.0
    g_hole_w = ph.hole_conductance(d, film, sc.worst_case_c) if n else 0.0
    g_hole_co2 = ph.hole_conductance(d, film, sc.temperature_c, "co2") if n else 0.0
    y_nom = ph.equilibrium_o2(p.demand_nom, g_film + n * g_hole)
    y_w = ph.equilibrium_o2(p.demand_worst, g_film_w + n * g_hole_w)
    co2 = ph.equilibrium_co2(p.demand_nom, p.rq, g_film, beta, n, g_hole_co2)

    in_window = (p.o2_window[0] - 0.01 <= y_nom <= p.o2_window[1] + 0.02) if p.o2_window else y_nom <= 0.17
    co2_ok = co2 <= (p.co2_window[1] + 0.03 if p.co2_window else 0.10)
    safe = y_w >= p.y_min - 0.005 and y_nom >= p.acp
    gas = {
        "o2": y_nom, "o2Worst": y_w, "co2": co2, "worstCaseC": sc.worst_case_c,
        "safe": safe, "inWindow": in_window, "co2Ok": co2_ok, "mapOk": safe and in_window and co2_ok,
        "o2SupplyNeededMlDay": p.demand_nom / max(1e-6, ph.O2_AIR - p.y_target),
    }
    water = (n * ph.hole_water_loss_g_day(d, film, sc.temperature_c, sc.aw or 0.98, sc.rh) if n else 0.0)
    gas["waterLossGDay"] = ph.structure_water_permeance(s, sc.temperature_c) * area * ph.p_sat_kpa(sc.temperature_c) \
        * max(0.0, (sc.aw or 0.98) - sc.rh) + water
    return perf, gas


def evaluate(s: StructureSpec, sc: Scenario, req: Requirements, costs: dict) -> Evaluation:
    rh_contact = max(sc.rh, sc.aw or 0.0)
    otr_t = ph.structure_otr(s, sc.temperature_c, rh_contact)
    k_t = ph.structure_water_permeance(s, sc.temperature_c)
    otr_test = ph.structure_otr_test(s)
    wvtr_test = ph.structure_wvtr_test(s)
    light_ok = any(m.light_barrier == "high" for m in s.materials)
    seal = s.seal_layer.material
    seal_ok = SEAL_RANK[seal.sealability] >= SEAL_RANK[req.seal_level] and (
        not req.contamination_tolerant or bool(seal.prop("contaminationTolerant")))
    mcap = map_capable(s, otr_test)

    perf, gas = (None, None)
    if req.produce:
        # Barrier laminates around produce are scored as unperforated packs, so "why not" has numbers.
        perf, gas = _design_perforation(s, sc, req)
        shelf = produce_life(sc, req, gas, gas["waterLossGDay"])
    else:
        shelf = barrier_life(sc, req, otr_t, k_t, light_ok, mcap, otr_test)

    fp = footprint(s, sc.pack_area_m2, sc.defaults["costs"], perforated=bool(perf and perf["required"]))
    ev = Evaluation(
        structure=s, otr_t=otr_t, otr_test=otr_test, wvtr_test=wvtr_test, k_t=k_t,
        perforation=perf, gas=gas, shelf=shelf, footprint=fp,
        mech_index=mechanical_index(s), pinholes=structure_pinholes(s),
        light_ok=light_ok, seal_ok=seal_ok, map_capable=mcap, target_days=sc.target_days,
    )
    ev.rows = requirement_rows(ev, sc, req)
    return ev


def _status(ok: bool) -> str:
    return "PASS" if ok else "REVIEW"


def requirement_rows(ev: Evaluation, sc: Scenario, req: Requirements) -> list[dict]:
    s = ev.structure
    rows: list[dict] = []
    t = sc.temperature_c

    # OTR / gas exchange
    if req.produce:
        p = req.produce
        target = (f"Controlled gas exchange: O₂ {window_text(p.o2_window)} at {t:g} °C, never below {pct(p.y_min)}"
                  if p.o2_window else f"Controlled gas exchange: keep O₂ at or above {pct(p.y_min)}")
        if req.gas_mode == "open":
            target = "Open gas exchange (low respiration): avoid O₂ depletion"
        ok = bool(ev.gas and ev.gas["safe"] and ev.gas["co2Ok"])
        rows.append({"label": "OTR target", "value": target, "status": _status(ok), "provenance": window_provenance(req)})
    elif req.otr_max_test is not None:
        rows.append({"label": "OTR target", "value": f"≤ {sig(req.otr_max_test)} cc/m²·day·atm (23 °C, 0 % RH)",
                     "status": _status(ev.otr_t <= req.otr_max_t * MARGIN), "provenance": PROV_RULE})
    else:
        rows.append({"label": "OTR target", "value": "Not critical (low oxidation risk)", "status": "PASS", "provenance": PROV_RULE})

    # WVTR
    if req.produce:
        loss = req.allowed_loss_frac or 0.05
        dehyd = ev.shelf.mechanisms.get("dehydration (weight loss)", math.inf)
        rows.append({"label": "WVTR target", "value": f"Moderate: weight loss under {loss * 100:g} % over {sc.target_days} days",
                     "status": _status(dehyd >= sc.target_days), "provenance": PROV_RULE})
    elif req.k_max_t is not None:
        tail = f" to keep weight loss under {req.allowed_loss_frac * 100:g} %" if req.moisture_mode == "loss" else ""
        rows.append({"label": "WVTR target", "value": f"≤ {sig(req.wvtr_max_test)} g/m²·day (38 °C, 90 % RH){tail}",
                     "status": _status(ev.k_t <= req.k_max_t * MARGIN), "provenance": PROV_RULE})
    else:
        rows.append({"label": "WVTR target", "value": "Not critical (product close to equilibrium with storage humidity)",
                     "status": "PASS", "provenance": PROV_RULE})

    if req.light:
        rows.append({"label": "Light barrier", "value": "High (opaque or metallised)",
                     "status": _status(ev.light_ok), "provenance": PROV_RULE})

    breakdown = " / ".join(f"{SHORT.get(l.material.id, l.material.id)} {l.thickness_um:g}" for l in s.layers)
    rows.append({"label": "Thickness", "value": f"{s.total_gauge_um:g} µm ({breakdown})",
                 "status": _status(ev.mech_index >= req.mech_index), "provenance": PROV_PROTO})

    if req.contamination_tolerant:
        seal_target = "High: contamination-tolerant sealant (mLLDPE or ionomer)"
    elif req.hermetic:
        seal_target = "High: hermetic seal for MAP or vacuum"
    else:
        seal_target = "Medium"
    rows.append({"label": "Sealability", "value": seal_target, "status": _status(ev.seal_ok), "provenance": PROV_RULE})

    rows.append({"label": "Mechanical protection",
                 "value": f"{sc.transport_stress.capitalize()} transport stress: index ≥ {req.mech_index:g}"
                          + (f", ≤ {req.max_pinholes:g} Gelbo pinholes" if s.gas_mode == "barrier" else ""),
                 "status": _status(ev.mech_index >= req.mech_index and (s.gas_mode != "barrier" or ev.pinholes <= req.max_pinholes)),
                 "provenance": PROV_PROTO})

    if req.produce:
        p = req.produce
        if req.gas_mode == "open":
            value = "Not suited: low respiration, ventilated pack preferred"
            ok = bool(ev.gas and ev.gas["safe"])
        else:
            value = (f"Equilibrium MAP: O₂ {window_text(p.o2_window)}"
                     + (f", CO₂ {window_text(p.co2_window)}" if p.co2_window else "")) if p.o2_window else "Equilibrium MAP (window not validated)"
            ok = bool(ev.gas and ev.gas["mapOk"])
        rows.append({"label": "MAP", "value": value, "status": _status(ok), "provenance": window_provenance(req)})
    elif req.map_label:
        rows.append({"label": "MAP", "value": req.map_label, "status": _status(ev.map_capable), "provenance": PROV_RULE})
    else:
        rows.append({"label": "MAP", "value": "Not required", "status": "PASS", "provenance": PROV_RULE})

    if req.anti_fog:
        rows.append({"label": "Anti-fog", "value": "Anti-fog inner surface (condensation risk)",
                     "status": _status(bool(s.seal_layer.material.prop("antiFog"))), "provenance": PROV_RULE})
    return rows


def layer_breakdown(s: StructureSpec) -> list[dict]:
    out = []
    for layer in s.layers:
        m = layer.material
        role = ROLES.get(layer.function, layer.function)
        if layer.function == "seal" and m.prop("sealRangeC"):
            lo, hi = m.prop("sealRangeC")
            role = f"Heat-seal layer ({lo}–{hi} °C)"
        out.append({"materialId": m.id, "name": m.name, "thicknessUm": layer.thickness_um,
                    "function": layer.function, "role": role})
    return out


def specifications(ev: Evaluation, sc: Scenario, req: Requirements) -> dict:
    s = ev.structure
    standards = sorted({std for m in s.materials for std in (m.prop("standards") or [])})
    fat = sc.v("fatPct") or 0
    ph_v = sc.v("ph")
    if fat >= 20:
        simulant = "Fatty food: n-heptane or rectified olive oil (IS 9845)"
    elif ph_v is not None and ph_v <= 4.5:
        simulant = "Acidic food: 3 % acetic acid (IS 9845)"
    else:
        simulant = "Aqueous neutral food: distilled water (IS 9845)"
    spec = {
        "otr": {
            "targetMax": round(req.otr_max_test, 3) if req.otr_max_test else None,
            "candidate": float(sig(ev.otr_test, 2).replace(",", "")),
            "atStorage": float(sig(ev.otr_t, 2).replace(",", "")),
            "unit": "cc/m²·day·atm", "testConditions": "23 °C, 0 % RH (ASTM D3985)",
        },
        "wvtr": {
            "targetMax": round(req.wvtr_max_test, 3) if req.wvtr_max_test else None,
            "candidate": float(sig(ev.wvtr_test, 2).replace(",", "")),
            "unit": "g/m²·day", "testConditions": "38 °C, 90 % RH (ASTM F1249)",
        },
        "totalGaugeUm": s.total_gauge_um,
        "layers": layer_breakdown(s),
        "mechanicalIndex": round(ev.mech_index),
        "gelboPinholes": ev.pinholes if s.gas_mode == "barrier" else None,
        "perforation": ev.perforation,
        "mapFlush": ({"label": req.map_label, **req.map_gases} if req.map_gases else None),
        "sealStrength": {"target": "≥ 15 N/15 mm (ASTM F88)" if req.seal_level == "high" else "≥ 10 N/15 mm (ASTM F88)",
                         "provenance": PROV_PROTO},
        "compliance": {
            "foodContactStandards": standards,
            "migrationSimulant": simulant,
            "overallMigrationLimit": "≤ 60 mg/kg food simulant or ≤ 10 mg/dm² (FSSAI Packaging Regulations 2018); confirm by test",
            "eprCategory": ev.footprint.epr_category,
        },
    }
    if ev.gas:
        spec["gasBalance"] = {
            "o2Pct": round(ev.gas["o2"] * 100, 1),
            "co2Pct": round(ev.gas["co2"] * 100, 1),
            "o2PctWorstCase": round(ev.gas["o2Worst"] * 100, 1),
            "worstCaseTempC": ev.gas["worstCaseC"],
            "provenance": PROV_RULE,
            "note": "Steady-state estimate; verify with headspace gas analysis.",
        }
    return spec
