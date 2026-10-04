"""Risks → packaging requirements, before any material is named (requirement-first).

Numeric targets come from the closed-form models in physics.py, solved backwards
from the user's target shelf life.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from . import physics as ph
from .context import Scenario
from .risks import Risk, light_sensitive
from .types import PROV_PROTO, PROV_RULE, PROV_SOURCE


@dataclass
class ProduceRequirement:
    r20: float
    q10: float
    rq: float
    acp: float  # fraction
    o2_window: tuple[float, float] | None  # fractions
    co2_window: tuple[float, float] | None
    window_provenance: str | None
    y_target: float  # nominal O₂ fraction to aim for
    y_min: float  # minimum O₂ fraction at the transit worst case
    demand_nom: float  # mL O₂/day per pack at storage temperature
    demand_worst: float  # ... at the transit worst case
    rate_nom: float  # mL O₂/kg·h at storage temperature
    rate_provenance: str
    allowed_loss_frac: float


@dataclass
class Requirements:
    gas_mode: str  # controlled | open | barrier
    produce: ProduceRequirement | None
    # Oxygen
    otr_max_t: float | None  # cc/m²·day·atm at storage conditions
    otr_max_test: float | None  # same target quoted at 23 °C
    o2_budget_ml: float | None
    o2_budget_mg_per_kg: float | None
    # Moisture
    moisture_mode: str | None  # gain | loss | None
    k_max_t: float | None  # g/m²·day·kPa at storage temperature
    wvtr_max_test: float | None
    allowed_loss_frac: float | None
    # Other functions
    light: bool
    seal_level: str  # medium | high
    contamination_tolerant: bool
    acid_resistant: bool
    hermetic: bool
    mech_index: float
    max_pinholes: float
    map_profile: str | None
    map_label: str | None
    map_gases: dict | None
    anti_fog: bool
    microbial: tuple[float, float] | None  # (days, reference °C)
    risks: list[Risk] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def has_risk(self, code: str) -> bool:
        return any(r.code == code for r in self.risks)


def _pct_window(value) -> tuple[float, float] | None:
    if not value:
        return None
    lo, hi = value
    return lo / 100.0, hi / 100.0


def derive(s: Scenario, risks: list[Risk]) -> Requirements:
    d = s.defaults
    codes = {r.code for r in risks}
    t, rh, days = s.temperature_c, s.rh, s.target_days
    mass, area = s.pack_mass_g, s.pack_area_m2
    resp = s.v("respirationClass") or "none"
    notes: list[str] = []

    # --- Gas exchange (fresh produce branch) ---
    produce = None
    gas_mode = "barrier"
    if s.is_produce:
        rd = d["respiration"]
        window_param = s.extra.get("o2WindowPct")
        o2w = _pct_window(s.v("o2WindowPct"))
        co2w = _pct_window(s.v("co2WindowPct"))
        gas_mode = "controlled" if resp in ("medium", "high") or o2w else "open"
        r20 = s.v("respRateO2At20", rd["rateO2At20"].get(resp, 0))
        q10 = s.v("respQ10", rd["q10"])
        acp = s.v("acpPct", rd["acpPct"]) / 100.0
        y_min = acp + 0.04  # Blueprint Challenge 1: 4 % safety buffer above the ACP
        y_target = (o2w[0] + o2w[1]) / 2 if o2w else min(0.15, acp + 0.06)
        y_target = max(y_target, y_min)
        produce = ProduceRequirement(
            r20=r20, q10=q10, rq=rd["rq"], acp=acp, o2_window=o2w, co2_window=co2w,
            window_provenance=window_param.provenance if window_param else None,
            y_target=y_target, y_min=y_min,
            demand_nom=ph.o2_demand_ml_day(r20, q10, t, mass),
            demand_worst=ph.o2_demand_ml_day(r20, q10, s.worst_case_c, mass),
            rate_nom=ph.respiration_rate(r20, q10, t),
            rate_provenance=s.extra["respRateO2At20"].provenance if "respRateO2At20" in s.extra else PROV_PROTO,
            allowed_loss_frac=s.cat_defaults.get("allowedMoistureLossPct", 5) / 100.0,
        )

    # --- Oxygen barrier (non-respiring, oxidation-sensitive) ---
    otr_max_t = otr_max_test = budget_ml = budget_mgkg = None
    if not s.is_produce and "OXIDATION" in codes:
        budget_mgkg = d["oxygenBudgetMgPerKg"][s.v("oxidationSensitivity") or "medium"]
        budget_ml = ph.o2_budget_ml(budget_mgkg, mass)
        otr_max_t = ph.required_otr(budget_ml, area, days)
        otr_max_test = ph.otr_at_test(otr_max_t, t)

    # --- Moisture barrier ---
    moisture_mode = k_max = wvtr_max = loss_frac = None
    aw = s.aw
    if s.is_produce:
        loss_frac = produce.allowed_loss_frac
        if aw is not None and aw > rh:
            moisture_mode = "loss"
            k_max = ph.required_k_loss(mass, loss_frac, aw, rh, area, t, days)
    elif "MOISTURE_GAIN" in codes and s.v("awCritical") and s.v("moistureCriticalPct"):
        moisture_mode = "gain"
        k_max = ph.required_k_gain(mass, s.v("moisturePct"), s.v("moistureCriticalPct"), aw,
                                   s.v("awCritical"), rh, area, t, days)
    elif "MOISTURE_LOSS" in codes:
        moisture_mode = "loss"
        loss_frac = s.cat_defaults.get("allowedMoistureLossPct", 2) / 100.0
        k_max = ph.required_k_loss(mass, loss_frac, aw, rh, area, t, days)
    if k_max is not None and math.isfinite(k_max):
        wvtr_max = ph.wvtr_at_test(k_max, t)
    else:
        k_max = None

    # --- Seal, mechanical, MAP ---
    contamination = "SEAL_CONTAMINATION" in codes
    map_key = None if s.is_produce else s.v("mapProfile")
    if map_key and not ({"MICROBIAL", "OXIDATION"} & codes):
        map_key = None
    profiles = d["mapProfiles"]
    map_entry = profiles.get(map_key) if map_key else None
    hermetic = bool(map_entry)
    stress = s.transport_stress
    mech = d["mechanical"][stress]
    scale = s.cat_defaults.get("mechanicalScale", 1.0)

    micro = s.v("microbialShelfLifeDays") if "MICROBIAL" in codes else None

    if "CHILLING_INJURY" in codes:
        notes.append(f"{s.name} is chilling-sensitive below {s.v('chillThresholdC'):g} °C. Packaging can't prevent chilling injury, "
                     f"so storing at {s.v('chillThresholdC'):g}–{s.v('chillThresholdC') + 3:g} °C is safer.")

    return Requirements(
        gas_mode=gas_mode,
        produce=produce,
        otr_max_t=otr_max_t,
        otr_max_test=otr_max_test,
        o2_budget_ml=budget_ml,
        o2_budget_mg_per_kg=budget_mgkg,
        moisture_mode=moisture_mode,
        k_max_t=k_max,
        wvtr_max_test=wvtr_max,
        allowed_loss_frac=loss_frac,
        light=light_sensitive(s) and not s.is_produce,
        seal_level="high" if contamination or hermetic else "medium",
        contamination_tolerant=contamination,
        acid_resistant="ACID" in codes,
        hermetic=hermetic,
        mech_index=mech["index"] * scale,
        max_pinholes=mech["pinholes"],
        map_profile=map_key,
        map_label=map_entry["label"] if map_entry else None,
        map_gases={k: map_entry[k] for k in ("o2", "co2", "n2")} if map_entry else None,
        anti_fog="CONDENSATION" in codes,
        microbial=tuple(micro) if micro else None,
        risks=risks,
        notes=notes,
    )


def window_provenance(req: Requirements) -> str:
    if req.produce and req.produce.window_provenance == PROV_SOURCE:
        return PROV_SOURCE
    return PROV_RULE
