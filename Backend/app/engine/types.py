"""Plain data types shared by the engine stages."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

PROV_SOURCE = "source-backed"
PROV_RULE = "rule-derived"
PROV_MODEL = "model-estimated"
PROV_PROTO = "prototype estimate"
PROV_USER = "user-edited"

SEAL_RANK = {"none": 0, "low": 1, "medium": 2, "high": 3}


@dataclass(frozen=True)
class Param:
    value: Any
    provenance: str | None = None
    confidence: str | None = None
    source_id: str | None = None
    unit: str | None = None

    def wrapped(self) -> dict:
        return {"value": self.value, "provenance": self.provenance, "confidence": self.confidence}


@dataclass
class CommodityRecord:
    id: str
    name: str
    category: str
    aliases: list[str] = field(default_factory=list)
    params: dict[str, Param] = field(default_factory=dict)
    source: str | None = None

    def get(self, key: str) -> Param | None:
        p = self.params.get(key)
        return p if p is not None and p.value is not None else None


@dataclass(frozen=True)
class MaterialSpec:
    id: str
    name: str
    family: str
    polymer_class: str
    density: float
    ref_thickness_um: float
    otr_ref: float
    wvtr_ref: float
    sealability: str
    epr_category: str
    metallized: bool
    non_plastic: bool
    compostable: bool
    cost_inr_per_kg: tuple[float, float]
    carbon_kg_per_kg: float
    provenance: str
    source_id: str | None
    props: dict = field(default_factory=dict, hash=False, compare=False)

    def prop(self, key: str, default: Any = None) -> Any:
        return self.props.get(key, default)

    @property
    def fixed_barrier(self) -> bool:
        return bool(self.props.get("fixedBarrier"))

    @property
    def barrier_ply(self) -> bool:
        return bool(self.props.get("barrierPly"))

    @property
    def light_barrier(self) -> str:
        return self.props.get("lightBarrier", "low")

    @property
    def gelbo_hi(self) -> float:
        return float((self.props.get("gelboPinholes") or [0, 0])[1])

    @property
    def toughness(self) -> float:
        return float(self.props.get("toughness", 1.0))

    @property
    def cost_mid(self) -> float:
        return (self.cost_inr_per_kg[0] + self.cost_inr_per_kg[1]) / 2


@dataclass(frozen=True)
class LayerSpec:
    material: MaterialSpec
    thickness_um: float
    function: str


@dataclass
class StructureSpec:
    id: str
    name: str
    gas_mode: str  # barrier | breathable
    perforation: str  # none | micro | macro
    layers: list[LayerSpec]
    props: dict = field(default_factory=dict)

    @property
    def seal_layer(self) -> LayerSpec:
        return self.layers[-1]

    @property
    def total_gauge_um(self) -> float:
        return sum(l.thickness_um for l in self.layers)

    @property
    def materials(self) -> list[MaterialSpec]:
        return [l.material for l in self.layers]

    def has(self, material_id: str) -> bool:
        return any(m.id == material_id for m in self.materials)


@dataclass
class Library:
    materials: dict[str, MaterialSpec]
    structures: list[StructureSpec]
    defaults: dict


SEED_DIR = Path(__file__).resolve().parent.parent / "seed"


@lru_cache
def category_defaults() -> dict:
    return json.loads((SEED_DIR / "category_defaults.json").read_text(encoding="utf-8"))
