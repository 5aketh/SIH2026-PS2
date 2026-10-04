"""Read-side repository: turns ORM rows into the engine's plain dataclasses."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db.models import Commodity, Material, Structure
from .engine.types import CommodityRecord, LayerSpec, Library, MaterialSpec, Param, StructureSpec, category_defaults


def to_material(m: Material) -> MaterialSpec:
    return MaterialSpec(
        id=m.id, name=m.name, family=m.family, polymer_class=m.polymer_class,
        density=m.density_g_cm3, ref_thickness_um=m.ref_thickness_um,
        otr_ref=m.otr_ref, wvtr_ref=m.wvtr_ref, sealability=m.sealability,
        epr_category=m.epr_category, metallized=m.metallized, non_plastic=m.non_plastic,
        compostable=m.compostable, cost_inr_per_kg=(m.cost_inr_per_kg_lo, m.cost_inr_per_kg_hi),
        carbon_kg_per_kg=m.carbon_kg_per_kg, provenance=m.provenance, source_id=m.source_id,
        props=dict(m.props or {}),
    )


def to_commodity(c: Commodity) -> CommodityRecord:
    return CommodityRecord(
        id=c.id, name=c.name, category=c.category, aliases=list(c.aliases or []),
        params={p.key: Param(p.value, p.provenance, p.confidence, p.source_id, p.unit) for p in c.params},
        source=c.source.citation if c.source else None,
    )


def load_library(db: Session) -> Library:
    materials = {m.id: to_material(m) for m in db.scalars(select(Material))}
    structures = [
        StructureSpec(
            id=s.id, name=s.name, gas_mode=s.gas_mode, perforation=s.perforation,
            layers=[LayerSpec(materials[l.material_id], l.thickness_um, l.function) for l in s.layers],
            props=dict(s.props or {}),
        )
        for s in db.scalars(select(Structure).order_by(Structure.id))
    ]
    return Library(materials=materials, structures=structures, defaults=category_defaults())


def get_commodity(db: Session, commodity_id: str) -> CommodityRecord | None:
    row = db.get(Commodity, commodity_id)
    return to_commodity(row) if row else None


def search_commodities(db: Session, query: str, limit: int = 20) -> list[Commodity]:
    rows = list(db.scalars(select(Commodity).order_by(Commodity.name)))
    q = query.strip().lower()
    if not q:
        return rows[:limit]
    hits = [
        c for c in rows
        if q in c.name.lower() or q in c.id.lower() or any(q in a.lower() for a in (c.aliases or []))
    ]
    # Prefix matches on the display name first.
    hits.sort(key=lambda c: (not c.name.lower().startswith(q), c.name))
    return hits[:limit]
