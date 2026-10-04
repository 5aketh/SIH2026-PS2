"""Multi-factor shelf-life estimate: the binding (shortest) mechanism wins.

Every estimate is a prototype estimate with a ±30 % band. The ML predictor can
replace it only when a model trained on real observations is enabled.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from . import physics as ph
from .types import PROV_PROTO

MAX_DAYS = 3650
BAND = 0.30


@dataclass
class ShelfLife:
    estimate: float
    failure_mode: str
    mechanisms: dict[str, float] = field(default_factory=dict)
    provenance: str = PROV_PROTO
    band: float = BAND

    @property
    def low(self) -> float:
        return self.estimate * (1 - self.band)

    @property
    def high(self) -> float:
        return self.estimate * (1 + self.band)

    def to_dict(self) -> dict:
        return {
            "estimateDays": round_days(self.estimate),
            "lowDays": round_days(self.low),
            "highDays": round_days(self.high),
            "failureMode": self.failure_mode,
            "mechanisms": {k: round_days(v) for k, v in self.mechanisms.items()},
            "provenance": self.provenance,
        }


def round_days(d: float) -> float:
    if not math.isfinite(d):
        return MAX_DAYS
    d = min(d, MAX_DAYS)
    return round(d, 1) if d < 10 else float(round(d))


def combine(mechanisms: dict[str, float]) -> ShelfLife:
    finite = {k: v for k, v in mechanisms.items() if math.isfinite(v)}
    if not finite:
        return ShelfLife(MAX_DAYS, "not limited by any modelled mechanism", mechanisms)
    mode = min(finite, key=finite.get)
    return ShelfLife(min(finite[mode], MAX_DAYS), mode, mechanisms)


def produce_life(sc, req, gas: dict, water_loss_g_day: float) -> ShelfLife:
    p = req.produce
    rd = sc.defaults["respiration"]
    resp = sc.v("respirationClass") or "medium"
    base = sc.v("airShelfLifeDays20", rd["airShelfLifeDays20"].get(resp, 7))
    chill = sc.v("chillThresholdC")
    t_eff = max(sc.temperature_c, chill) if chill is not None else sc.temperature_c
    air_life = base * rd["shelfLifeQ10"] ** ((20 - t_eff) / 10)

    y_nom, y_worst, co2 = gas["o2"], gas["o2Worst"], gas["co2"]
    mode = "senescence and ripening"
    if y_nom < p.acp:
        factor, mode = 0.35, "anaerobic fermentation"
    elif y_worst < p.acp:
        factor, mode = 0.6, "anaerobic fermentation during the transit excursion"
    elif gas["mapOk"]:
        factor, mode = 1.5, "senescence (slowed by modified atmosphere)"
    elif y_nom < 0.17:
        factor = 1.2
    else:
        factor = 1.0
    if p.co2_window and co2 > p.co2_window[1] + 0.05:
        factor *= 0.6
        mode = "CO₂ injury"

    mechanisms = {mode: air_life * factor}
    if water_loss_g_day > 0:
        mechanisms["dehydration (weight loss)"] = p.allowed_loss_frac * sc.pack_mass_g / water_loss_g_day
    return combine(mechanisms)


def barrier_life(sc, req, otr_t: float, k_t: float, light_ok: bool, map_capable: bool, otr_test: float) -> ShelfLife:
    mechanisms: dict[str, float] = {}
    t, rh, mass, area = sc.temperature_c, sc.rh, sc.pack_mass_g, sc.pack_area_m2
    if req.moisture_mode == "gain":
        mechanisms["moisture gain (texture loss or caking)"] = ph.moisture_gain_days(
            mass, sc.v("moisturePct"), sc.v("moistureCriticalPct"), sc.aw, sc.v("awCritical"), rh, k_t, area, t)
    elif req.moisture_mode == "loss":
        mechanisms["moisture loss (drying or freezer burn)"] = ph.moisture_loss_days(
            mass, req.allowed_loss_frac, sc.aw, rh, k_t, area, t)
    if req.o2_budget_ml:
        days = ph.oxygen_budget_days(req.o2_budget_ml, otr_t, area)
        if req.light and not light_ok:
            days *= 0.5
        mechanisms["lipid oxidation (rancidity)"] = days
    if req.microbial:
        ref_days, ref_t = req.microbial
        factor = 2.5 if (req.map_profile and map_capable) else 1.3 if otr_test < 500 else 1.0
        mechanisms["microbial spoilage"] = ph.microbial_days(ref_days, ref_t, t) * factor
    return combine(mechanisms)
