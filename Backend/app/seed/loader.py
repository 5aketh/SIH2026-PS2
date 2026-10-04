"""Idempotent seed loader: `python -m app.seed.loader`.

Upserts sources, commodities (with per-field provenance), materials and
structures from the JSON files next to this module. Re-running replaces
seeded rows with the file contents and leaves stored analyses alone.
"""
import json
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..db.models import Commodity, CommodityParam, Material, Source, Structure, StructureLayer

SEED_DIR = Path(__file__).resolve().parent


def _read(name: str):
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


def _param(key: str, raw, defaults: dict) -> CommodityParam:
    if isinstance(raw, dict) and "value" in raw:
        return CommodityParam(
            key=key,
            value=raw["value"],
            unit=raw.get("unit"),
            provenance=raw.get("provenance"),
            confidence=raw.get("confidence"),
            source_id=raw.get("sourceId"),
        )
    return CommodityParam(
        key=key,
        value=raw,
        provenance=defaults["provenance"] if raw is not None else None,
        confidence=defaults["confidence"] if raw is not None else None,
        source_id=defaults["sourceId"] if raw is not None else None,
    )


def seed(db: Session) -> dict:
    for s in _read("sources.json"):
        db.merge(Source(id=s["id"], title=s["title"], citation=s["citation"], url=s.get("url"), retrieved_on=s.get("retrievedOn")))
    db.flush()

    data = _read("commodities.json")
    defaults = data["defaults"]
    for c in data["commodities"]:
        db.execute(delete(CommodityParam).where(CommodityParam.commodity_id == c["id"]))
        row = db.merge(Commodity(
            id=c["id"], name=c["name"], category=c["category"],
            aliases=c.get("aliases", []), source_id=c.get("sourceId", defaults["sourceId"]),
        ))
        row.params = [_param(k, v, defaults) for k, v in c["params"].items()]

    for m in _read("materials.json")["materials"]:
        db.merge(Material(
            id=m["id"], name=m["name"], family=m["family"], polymer_class=m["polymerClass"],
            density_g_cm3=m["densityGcm3"], ref_thickness_um=m["refThicknessUm"],
            otr_ref=m["otrRef"], wvtr_ref=m["wvtrRef"], sealability=m["sealability"],
            epr_category=m["eprCategory"], metallized=m.get("metallized", False),
            non_plastic=m.get("nonPlastic", False), compostable=m.get("compostable", False),
            cost_inr_per_kg_lo=m["costInrPerKg"][0], cost_inr_per_kg_hi=m["costInrPerKg"][1],
            carbon_kg_per_kg=m["carbonKgPerKg"], provenance=m["provenance"],
            source_id=m.get("sourceId"), props=m.get("props", {}),
        ))
    db.flush()

    structures = _read("structures.json")["structures"]
    for s in structures:
        db.execute(delete(StructureLayer).where(StructureLayer.structure_id == s["id"]))
        row = db.merge(Structure(
            id=s["id"], name=s["name"], gas_mode=s["gasMode"], perforation=s["perforation"], props=s.get("props", {}),
        ))
        row.layers = [
            StructureLayer(position=i, material_id=mid, thickness_um=t, function=fn)
            for i, (mid, t, fn) in enumerate(s["layers"])
        ]
    db.commit()
    return {"commodities": len(data["commodities"]), "structures": len(structures)}


if __name__ == "__main__":
    from ..db.session import SessionLocal

    with SessionLocal() as session:
        print("Seeded:", seed(session))
