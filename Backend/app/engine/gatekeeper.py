"""Layer 1: hard constraints. A structure that breaks one is rejected with a reason ("Why not this?")."""
from __future__ import annotations

from dataclasses import dataclass

from .context import Scenario
from .lca_cost import Footprint
from .requirements import Requirements
from .types import StructureSpec

BAND_RANK = {"low": 0, "medium": 1, "high": 2}


@dataclass
class Constraint:
    raw: str
    key: str
    value: str


def parse_constraints(raw: list[str]) -> tuple[list[Constraint], list[str]]:
    """Valid constraints plus plain-language warnings for the ones that were ignored.

    Several cost-band limits collapse to the strictest, so a structure fails it once.
    """
    parsed, warnings = [], []
    for item in raw:
        key, _, value = item.strip().partition(":")
        key, value = key.strip().lower(), value.strip()
        ok = (
            (key in ("recyclable", "mono_material", "compostable", "food_contact_grade", "no_metallised") and value.lower() in ("true", "false"))
            or (key == "max_cost_band" and value.lower() in BAND_RANK)
            or (key == "exclude_material" and value)
            or (key == "max_gauge_um" and value.replace(".", "", 1).isdigit())
        )
        if ok:
            parsed.append(Constraint(item, key, value))
        else:
            warnings.append(f"The requirement \"{item.strip()}\" wasn't recognised, so it was ignored.")
    bands = [c for c in parsed if c.key == "max_cost_band"]
    if len(bands) > 1:
        strictest = min(bands, key=lambda c: BAND_RANK[c.value.lower()])
        parsed = [c for c in parsed if c.key != "max_cost_band" or c is strictest]
    return parsed, warnings


CONSTRAINT_LABELS = {
    "recyclable:true": "Must be recyclable",
    "mono_material:true": "Single material only",
    "compostable:true": "Must be compostable",
    "no_metallised:true": "No metallised or foil layers",
    "food_contact_grade:true": "Food-contact approved layers only",
    "max_cost_band:low": "Low cost band at most",
    "max_cost_band:medium": "Medium cost band at most",
    "max_cost_band:high": "Any cost band",
}


def describe(raw: str, material_names: dict[str, str] | None = None) -> str:
    """A hard constraint in words, e.g. 'exclude_material:AL_FOIL' -> 'No Aluminium foil (9 µm)'."""
    key, _, value = raw.strip().partition(":")
    label = CONSTRAINT_LABELS.get(f"{key.lower()}:{value.lower()}")
    if label:
        return label
    if key == "exclude_material":
        return f"No {(material_names or {}).get(value.upper(), value)}"
    if key == "max_gauge_um":
        return f"At most {value} µm thick"
    return raw


def structure_pinholes(s: StructureSpec) -> float:
    """Gelbo flex pinholes (ASTM F392) for the structure: set by its most crack-prone barrier ply."""
    barrier = [m.gelbo_hi for m in s.materials if m.barrier_ply]
    value = max(barrier) if barrier else max(m.gelbo_hi for m in s.materials)
    if any(m.prop("flexToughener") for m in s.materials):
        value /= 2  # BOPA absorbs flex stress (Blueprint failure-mode matrix)
    return value


def check(s: StructureSpec, sc: Scenario, req: Requirements, fp: Footprint, constraints: list[Constraint]) -> list[str]:
    reasons: list[str] = []
    seal = s.seal_layer.material

    if seal.sealability == "none":
        reasons.append(f"Its inner layer ({seal.name}) can't be heat-sealed.")
    if any(not m.prop("standards") for m in s.materials):
        reasons.append("One of its layers has no food-contact approval on record (FSSAI 2018 or a BIS resin standard).")

    if sc.is_produce and s.gas_mode == "barrier":
        reasons.append("It's a sealed high-barrier pack, so the produce, which keeps breathing after harvest, would run out of oxygen.")
    if not sc.is_produce and s.gas_mode == "breathable":
        reasons.append("It's a breathable produce film, which gives a food that doesn't breathe no protection from moisture or oxygen.")

    if req.contamination_tolerant and seal.id == "LDPE":
        reasons.append("Its plain LDPE seal layer can't seal through oil or moisture left on the seal area; "
                       "this food needs an mLLDPE or ionomer seal layer.")
    if req.acid_resistant and s.has("AL_FOIL") and not seal.prop("acidResistant"):
        reasons.append("This acidic, moist food could eat through to the aluminium foil, because the seal layer isn't acid-resistant.")
    if sc.is_frozen:
        brittle = [m.name for m in s.materials if m.prop("brittleCold")]
        if brittle:
            reasons.append(f"Its {brittle[0]} layer turns brittle at freezer temperatures.")
    if s.gas_mode == "barrier":
        pinholes = structure_pinholes(s)
        if pinholes > req.max_pinholes:
            reasons.append(f"It's likely to crack when flexed in transport: up to {pinholes:g} pinholes in a Gelbo flex test, "
                           f"more than the {req.max_pinholes:g} allowed for {sc.transport_stress} transport stress.")

    for c in constraints:
        v = c.value.lower()
        if c.key == "recyclable" and v == "true" and not fp.recyclable:
            reasons.append("Not recyclable: you asked for a recyclable pack, and this isn't a single recyclable plastic.")
        elif c.key == "mono_material" and v == "true" and not fp.mono_material:
            reasons.append("Mixes different plastics, but you asked for a single-material pack.")
        elif c.key == "compostable" and v == "true" and not all(m.compostable for m in s.materials):
            reasons.append("Has layers that aren't compostable, but you asked for a compostable pack.")
        elif c.key == "no_metallised" and v == "true" and any(m.metallized or m.non_plastic for m in s.materials):
            reasons.append("Has a metallised or foil layer, which you ruled out.")
        elif c.key == "max_cost_band" and BAND_RANK[fp.cost_band] > BAND_RANK[v]:
            reasons.append(f"Too expensive for your {v}-cost target: this pack is in the {fp.cost_band} cost band.")
        elif c.key == "max_gauge_um" and s.total_gauge_um > float(c.value):
            reasons.append(f"Thicker than your {float(c.value):g} µm limit: {s.total_gauge_um:g} µm in total.")
        elif c.key == "exclude_material":
            hit = [m.name for m in s.materials if m.id.lower() == v or m.family.lower() == v]
            if hit:
                reasons.append(f"Contains {hit[0]}, which you excluded.")
    return reasons
