"""Stages 1-2: ingest the user context, validate it, and normalise it into a Scenario.

Each value keeps its provenance: what the user typed (`user-edited`), what the catalog
holds (its own label), or a category fallback (`prototype estimate`). Missing critical
fields don't block the analysis; they lower confidence instead (Team Report §4.3).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from . import storage
from .types import PROV_PROTO, PROV_USER, CommodityRecord, Param

PROFILE_KEYS = ("moisturePct", "fatPct", "ph", "respirationClass", "oxidationSensitivity")
PROFILE_LABELS = {
    "moisturePct": "moisture", "fatPct": "fat", "ph": "pH",
    "respirationClass": "respiration class", "oxidationSensitivity": "oxidation sensitivity",
}

# Category fallbacks for profile fields the user left empty (prototype estimates).
TYPICAL = {
    "fresh_produce": {"moisturePct": 90.0, "fatPct": 0.3, "ph": 5.0, "respirationClass": "medium", "oxidationSensitivity": "medium"},
    "dry_goods": {"moisturePct": 12.0, "fatPct": 2.0, "ph": 6.5, "respirationClass": "none", "oxidationSensitivity": "low"},
    "snack": {"moisturePct": 3.0, "fatPct": 25.0, "ph": 6.0, "respirationClass": "none", "oxidationSensitivity": "high"},
    "dairy": {"moisturePct": 60.0, "fatPct": 15.0, "ph": 6.2, "respirationClass": "none", "oxidationSensitivity": "medium"},
    "meat_seafood": {"moisturePct": 75.0, "fatPct": 5.0, "ph": 6.0, "respirationClass": "none", "oxidationSensitivity": "medium"},
    "other": {"moisturePct": 50.0, "fatPct": 5.0, "ph": 6.0, "respirationClass": "none", "oxidationSensitivity": "medium"},
}

# Moisture (%) → water activity, a rough prototype curve used only when aw is unknown.
_AW_CURVE = [(0, 0.05), (2, 0.15), (5, 0.30), (10, 0.50), (14, 0.65), (20, 0.80), (30, 0.88),
             (45, 0.93), (60, 0.97), (75, 0.985), (100, 0.995)]


class ScenarioError(Exception):
    """A request that is well-formed but physically inconsistent; carries the contract field path."""

    def __init__(self, field: str, message: str):
        super().__init__(message)
        self.field = field
        self.message = message


def estimate_aw(moisture_pct: float) -> float:
    for (m0, a0), (m1, a1) in zip(_AW_CURVE, _AW_CURVE[1:]):
        if moisture_pct <= m1:
            return a0 + (a1 - a0) * (moisture_pct - m0) / (m1 - m0)
    return 0.995


def estimate_mcrit(m0_pct: float, aw0: float, awc: float) -> float:
    """Critical moisture from a generic sorption slope of 0.10 g water/g solids per aw unit (prototype)."""
    x0 = m0_pct / (100 - m0_pct)
    xc = x0 + 0.10 * max(0.0, awc - aw0)
    return 100 * xc / (1 + xc)


@dataclass
class Scenario:
    commodity_id: str | None
    name: str
    is_custom: bool
    category: str
    profile: dict[str, Param]
    extra: dict[str, Param]
    temperature_c: float
    rh: float  # fraction
    storage_type: str
    target_days: int
    transport_mode: str
    transport_stress: str
    worst_case_c: float
    priorities: dict[str, float]
    hard_constraints: list[str]
    pack_mass_g: float
    pack_area_m2: float
    pack_format: str
    pack_provenance: str
    defaults: dict
    confidence: str = "medium"
    confidence_reasons: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def v(self, key: str, default: Any = None) -> Any:
        p = self.profile.get(key) or self.extra.get(key)
        return default if p is None or p.value is None else p.value

    @property
    def cat_defaults(self) -> dict:
        return self.defaults["categories"].get(self.category, self.defaults["categories"]["other"])

    @property
    def is_produce(self) -> bool:
        return self.category == "fresh_produce" or self.v("respirationClass") in ("medium", "high")

    @property
    def is_frozen(self) -> bool:
        return self.storage_type == "frozen" or self.temperature_c <= -5

    @property
    def aw(self) -> float | None:
        return self.v("awInitial")

    @property
    def moisture_sensitive(self) -> bool:
        return self.v("moistureSensitive", True) is not False and self.aw is not None


def _same(a: Any, b: Any) -> bool:
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(float(a) - float(b)) < 1e-6
    return a == b


def _validate(req) -> None:
    c = req.conditions
    t = c.temperature_c
    if c.storage_type == "frozen" and t > -10:
        raise ScenarioError("conditions.temperatureC", "Frozen storage needs a temperature of −10 °C or lower.")
    if c.storage_type == "chilled" and not -2 <= t <= 15:
        raise ScenarioError("conditions.temperatureC", "Chilled storage is normally between −2 °C and 15 °C.")
    if c.storage_type == "ambient" and t < 5:
        raise ScenarioError("conditions.temperatureC", "Below 5 °C counts as chilled storage. Change the storage type or the temperature.")
    p = req.commodity.profile
    if p.moisture_pct is not None and p.fat_pct is not None and p.moisture_pct + p.fat_pct > 100.5:
        raise ScenarioError("commodity.profile.fatPct", "Moisture and fat together can't exceed 100 %.")


def build_scenario(req, record: CommodityRecord | None, defaults: dict) -> Scenario:
    _validate(req)
    reasons: list[str] = []
    assumptions: list[str] = []
    warnings: list[str] = []

    if req.commodity.commodity_id and record is None:
        warnings.append(f"Commodity '{req.commodity.commodity_id}' isn't in the catalog, so it was analysed as a custom food.")

    p = req.commodity.profile
    resp_in = p.respiration_class
    category = p.category or (record.category if record else None)
    if category is None:
        category = "fresh_produce" if resp_in in ("low", "medium", "high") else "other"
        reasons.append("Category was not given and was inferred from the respiration class.")

    name = (req.commodity.commodity_name or (record.name if record else "Custom food")).strip() or "Custom food"
    issue = storage.problem(storage.rule(category, record, defaults, name), name,
                            req.conditions.storage_type, req.conditions.temperature_c)
    if issue:
        raise ScenarioError(*issue)

    requested = {
        "moisturePct": p.moisture_pct, "fatPct": p.fat_pct, "ph": p.ph,
        "respirationClass": resp_in, "oxidationSensitivity": p.oxidation_sensitivity,
    }
    profile: dict[str, Param] = {}
    edited: set[str] = set()
    for key in PROFILE_KEYS:
        value = requested[key]
        rec = record.get(key) if record else None
        if value is not None:
            if rec is not None and _same(rec.value, value):
                profile[key] = rec
            else:
                profile[key] = Param(value, PROV_USER, None)
                edited.add(key)
        elif rec is not None:
            profile[key] = rec
        elif key == "ph" and record is not None and key in record.params:
            # The catalog deliberately has no pH for this food (e.g. oils).
            profile[key] = Param(None)
        else:
            profile[key] = Param(TYPICAL[category][key], PROV_PROTO, "prototype")
            reasons.append(f"No {PROFILE_LABELS[key]} given; a typical {category.replace('_', ' ')} value was assumed.")

    # Engine-only parameters come from the catalog, unless the user changed the moisture they depend on.
    extra: dict[str, Param] = {}
    if record:
        for key, param in record.params.items():
            if key not in PROFILE_KEYS and param.value is not None:
                extra[key] = param
    if "moisturePct" in edited:
        extra.pop("awInitial", None)
        extra.pop("moistureCriticalPct", None)

    cat = defaults["categories"].get(category, defaults["categories"]["other"])
    moisture = profile["moisturePct"].value
    fat = profile["fatPct"].value or 0
    if moisture is not None and fat > 90 and moisture < 1:
        extra.setdefault("moistureSensitive", Param(False, PROV_PROTO, "prototype"))
    if "awInitial" not in extra and extra.get("moistureSensitive", Param(True)).value is not False:
        if moisture is not None:
            extra["awInitial"] = Param(round(estimate_aw(moisture), 2), PROV_PROTO, "prototype")
            assumptions.append(f"Water activity estimated from {moisture:g} % moisture (≈ {extra['awInitial'].value}).")
        elif cat.get("awInitial") is not None:
            extra["awInitial"] = Param(cat["awInitial"], PROV_PROTO, "prototype")
    aw0 = extra.get("awInitial").value if extra.get("awInitial") else None
    if aw0 is not None and aw0 < 0.85 and "awCritical" not in extra and cat.get("awCritical") is not None:
        extra["awCritical"] = Param(max(cat["awCritical"], aw0 + 0.1), PROV_PROTO, "prototype")
        assumptions.append(f"Critical water activity taken as {extra['awCritical'].value:g} (category default).")
    if aw0 is not None and "awCritical" in extra and "moistureCriticalPct" not in extra and moisture is not None:
        mc = estimate_mcrit(moisture, aw0, extra["awCritical"].value)
        extra["moistureCriticalPct"] = Param(round(mc, 1), PROV_PROTO, "prototype")
        assumptions.append(f"Critical moisture estimated at {mc:.1f} % from a generic sorption slope.")
    if "microbialShelfLifeDays" not in extra and cat.get("microbialShelfLifeDays"):
        extra["microbialShelfLifeDays"] = Param(cat["microbialShelfLifeDays"], PROV_PROTO, "prototype")
    if "mapProfile" not in extra and cat.get("mapProfile"):
        extra["mapProfile"] = Param(cat["mapProfile"], PROV_PROTO, "prototype")

    pkg = req.package
    mass = (pkg.net_weight_g if pkg and pkg.net_weight_g else None) or cat["pack"]["netWeightG"]
    area = (pkg.area_m2 if pkg and pkg.area_m2 else None) or cat["pack"]["areaM2"]
    fmt = (pkg.format if pkg and pkg.format else None) or cat["pack"]["format"]
    pack_prov = PROV_USER if pkg and (pkg.net_weight_g or pkg.area_m2) else PROV_PROTO
    if pack_prov == PROV_PROTO:
        assumptions.append(f"Pack format assumed: {fmt} ({mass:g} g, {area:g} m² film area).")

    c = req.conditions
    t = c.temperature_c
    worst = {
        "ambient_transport": max(t, 30.0),
        "refrigerated_transport": t + 4.0,
        "frozen_transport": t,
        "none": t,
    }[c.transport_mode]
    if worst != t:
        assumptions.append(f"Transit excursion to {worst:g} °C checked for produce gas balance.")

    is_custom = req.commodity.is_custom or record is None
    if is_custom:
        reasons.insert(0, "Custom commodity: properties weren't matched to a catalog record.")
    low_conf_data = [k for k, prm in profile.items() if prm.provenance == PROV_PROTO]
    confidence = "prototype" if is_custom or low_conf_data else "medium"
    if confidence == "medium":
        reasons.append("Catalog food profile; engine constants are prototype estimates pending lab validation.")

    pr = req.priorities
    return Scenario(
        commodity_id=record.id if record else None,
        name=name,
        is_custom=is_custom,
        category=category,
        profile=profile,
        extra=extra,
        temperature_c=t,
        rh=c.relative_humidity_pct / 100.0,
        storage_type=c.storage_type,
        target_days=c.target_shelf_life_days,
        transport_mode=c.transport_mode,
        transport_stress=c.transport_stress,
        worst_case_c=worst,
        priorities={
            "shelfLife": pr.shelf_life, "cost": pr.cost,
            "sustainability": pr.sustainability, "mechanicalStrength": pr.mechanical_strength,
        },
        hard_constraints=list(pr.hard_constraints),
        pack_mass_g=mass,
        pack_area_m2=area,
        pack_format=fmt,
        pack_provenance=pack_prov,
        defaults=defaults,
        confidence=confidence,
        confidence_reasons=reasons,
        assumptions=assumptions,
        warnings=warnings,
    )
