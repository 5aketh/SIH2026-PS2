"""Per-pack cost, embodied carbon and EPR classification (Blueprint 'LCA & Cost Estimator')."""
from __future__ import annotations

from dataclasses import dataclass

from .types import StructureSpec

RECYCLABLE_CLASSES = {"PE", "PP"}


@dataclass
class Footprint:
    grams: float
    inr_per_pack: float
    inr_per_m2: float
    cost_band: str
    g_co2e: float
    epr_category: str
    epr_fee_inr: float
    mono_material: bool
    recyclable: bool
    recyclability_index: int

    def to_dict(self) -> dict:
        return {
            "inrPerPack": round(self.inr_per_pack, 2),
            "costBand": self.cost_band,
            "gramsPerPack": round(self.grams, 1),
            "gCo2ePerPack": round(self.g_co2e, 1),
            "eprCategory": self.epr_category,
            "eprFeeInrPerPack": round(self.epr_fee_inr, 3),
            "monoMaterial": self.mono_material,
            "recyclable": self.recyclable,
            "recyclabilityIndex": self.recyclability_index,
            "provenance": "prototype estimate",
        }


def epr_category(s: StructureSpec) -> str:
    """CPCB EPR: III if any non-plastic or metallised ply (Blueprint), IV if fully compostable, else II."""
    mats = s.materials
    if any(m.non_plastic or m.metallized for m in mats):
        return "III"
    if all(m.compostable for m in mats):
        return "IV"
    return "II"


def is_mono(s: StructureSpec) -> bool:
    classes = {m.polymer_class for m in s.materials}
    return len(classes) == 1 and classes <= RECYCLABLE_CLASSES


def recyclability_index(s: StructureSpec) -> int:
    mats = s.materials
    if any(m.non_plastic for m in mats):
        return 10
    if any(m.metallized for m in mats):
        return 25
    if all(m.compostable for m in mats):
        return 60
    if is_mono(s):
        return 90
    return 40


def footprint(s: StructureSpec, area_m2: float, costs: dict, perforated: bool) -> Footprint:
    grams = 0.0
    material_inr = 0.0
    carbon = 0.0
    for layer in s.layers:
        g = layer.material.density * layer.thickness_um * area_m2  # g/cm³ · µm · m² = g
        grams += g
        material_inr += g / 1000 * layer.material.cost_mid
        carbon += g * layer.material.carbon_kg_per_kg
    conversion = area_m2 * (costs["conversionBaseInrPerM2"] + costs["conversionPerLaminationInrPerM2"] * (len(s.layers) - 1))
    if perforated:
        conversion += costs["perforationInrPerPack"]
    total = material_inr + conversion
    per_m2 = total / area_m2
    bands = costs["costBandInrPerM2"]
    band = "low" if per_m2 < bands["low"] else "medium" if per_m2 < bands["medium"] else "high"
    cat = epr_category(s)
    mono = is_mono(s)
    return Footprint(
        grams=grams,
        inr_per_pack=total,
        inr_per_m2=per_m2,
        cost_band=band,
        g_co2e=carbon,
        epr_category=cat,
        epr_fee_inr=grams / 1000 * costs["eprFeeInrPerKg"].get(cat, 5),
        mono_material=mono,
        recyclable=mono and cat == "II",
        recyclability_index=recyclability_index(s),
    )
