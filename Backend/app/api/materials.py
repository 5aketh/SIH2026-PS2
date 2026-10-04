"""Material Explorer (Features Report §4): browse, filter and compare the knowledge base."""
import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db.models import Source
from ..db.session import get_db
from ..engine import physics as ph
from ..engine.evaluate import layer_breakdown, mechanical_index
from ..engine.gatekeeper import structure_pinholes
from ..engine.lca_cost import epr_category, is_mono, recyclability_index
from ..engine.types import MaterialSpec, StructureSpec
from ..errors import ApiError
from ..repo import load_library

router = APIRouter(tags=["materials"])

SEAL_SCORE = {"high": 90, "medium": 60, "low": 30, "none": 0}


def _log_score(value: float, best: float, worst: float) -> int:
    """0-100 on a log scale: `best` (low transmission) → 100, `worst` → 0."""
    v = math.log10(max(value, 1e-3))
    return round(max(0.0, min(1.0, (math.log10(worst) - v) / (math.log10(worst) - math.log10(best)))) * 100)


def indicators(m: MaterialSpec) -> dict:
    sustainability = 100 - min(100, m.carbon_kg_per_kg * 8)
    if m.compostable:
        sustainability += 15
    if m.metallized or m.non_plastic:
        sustainability -= 20
    return {
        "oxygenBarrier": _log_score(m.otr_ref, 0.05, 10000),
        "moistureBarrier": _log_score(m.wvtr_ref, 0.05, 300),
        "mechanicalStrength": round(min(100, m.toughness / 3 * 100)),
        "sealability": SEAL_SCORE[m.sealability],
        "sustainability": round(max(0, min(100, sustainability))),
    }


def material_dict(m: MaterialSpec, sources: dict[str, str]) -> dict:
    return {
        "materialId": m.id,
        "name": m.name,
        "family": m.family,
        "polymerClass": m.polymer_class,
        "indicators": indicators(m),
        "properties": {
            "densityGcm3": m.density,
            "referenceThicknessUm": m.ref_thickness_um,
            "otr": {"value": m.otr_ref, "unit": "cc/m²·day·atm", "conditions": "23 °C, 0 % RH", "provenance": m.provenance},
            "wvtr": {"value": m.wvtr_ref, "unit": "g/m²·day", "conditions": "38 °C, 90 % RH", "provenance": m.provenance},
            "sealRangeC": m.prop("sealRangeC"),
            "sealability": m.sealability,
            "gelboPinholes": m.prop("gelboPinholes"),
            "costInrPerKg": list(m.cost_inr_per_kg),
            "carbonKgCo2ePerKg": m.carbon_kg_per_kg,
            "eprCategory": m.epr_category,
            "compostable": m.compostable,
            "metallised": m.metallized,
            "lightBarrier": m.light_barrier,
            "humiditySensitive": bool(m.prop("humiditySensitive")),
            "contaminationTolerantSeal": bool(m.prop("contaminationTolerant")),
        },
        "standards": m.prop("standards", []),
        "applications": m.prop("applications", []),
        "notes": m.prop("notes"),
        "provenance": m.provenance,
        "source": sources.get(m.source_id or ""),
    }


def _sources(db: Session) -> dict[str, str]:
    return {s.id: s.citation for s in db.query(Source).all()}


@router.get("/api/materials")
def list_materials(
    q: str = Query("", max_length=80),
    family: str | None = Query(None, max_length=40),
    max_otr: float | None = Query(None, alias="maxOtr", ge=0),
    max_wvtr: float | None = Query(None, alias="maxWvtr", ge=0),
    recyclable: bool | None = None,
    compostable: bool | None = None,
    sort: str = Query("name", pattern="^(name|oxygenBarrier|moistureBarrier|mechanicalStrength|sustainability|cost)$"),
    db: Session = Depends(get_db),
) -> dict:
    lib = load_library(db)
    sources = _sources(db)
    ql = q.strip().lower()
    out = []
    for m in lib.materials.values():
        if ql and ql not in m.name.lower() and ql not in m.id.lower() and ql not in m.family.lower() \
                and not any(ql in a.lower() for a in m.prop("applications", [])):
            continue
        if family and m.family != family.lower():
            continue
        if max_otr is not None and m.otr_ref > max_otr:
            continue
        if max_wvtr is not None and m.wvtr_ref > max_wvtr:
            continue
        if recyclable is not None and (m.epr_category == "II" and m.polymer_class in ("PE", "PP")) != recyclable:
            continue
        if compostable is not None and m.compostable != compostable:
            continue
        out.append(material_dict(m, sources))
    if sort == "name":
        out.sort(key=lambda d: d["name"])
    elif sort == "cost":
        out.sort(key=lambda d: d["properties"]["costInrPerKg"][0])
    else:
        out.sort(key=lambda d: -d["indicators"][sort])
    return {"results": out, "families": sorted({m.family for m in lib.materials.values()})}


@router.get("/api/materials/{material_id}")
def material_detail(material_id: str, db: Session = Depends(get_db)) -> dict:
    lib = load_library(db)
    m = lib.materials.get(material_id.upper())
    if m is None:
        raise ApiError("NOT_FOUND", "That material isn't in the knowledge base.", 404)
    me = indicators(m)
    keys = list(me)

    def dist(other: MaterialSpec) -> float:
        o = indicators(other)
        return math.sqrt(sum((me[k] - o[k]) ** 2 for k in keys))

    others = sorted((o for o in lib.materials.values() if o.id != m.id), key=dist)
    sources = _sources(db)
    used_in = [{"structureId": s.id, "name": s.name} for s in lib.structures if s.has(m.id)]
    return {
        **material_dict(m, sources),
        "usedInStructures": used_in,
        "similar": [{"materialId": o.id, "name": o.name, "indicators": indicators(o)} for o in others[:3]],
    }


def structure_dict(s: StructureSpec) -> dict:
    return {
        "structureId": s.id,
        "name": s.name,
        "gasMode": s.gas_mode,
        "perforation": s.perforation,
        "totalGaugeUm": s.total_gauge_um,
        "layers": layer_breakdown(s),
        "otrTest": float(f"{ph.structure_otr_test(s):.3g}"),
        "wvtrTest": float(f"{ph.structure_wvtr_test(s):.3g}"),
        "mechanicalIndex": round(mechanical_index(s)),
        "gelboPinholes": structure_pinholes(s),
        "eprCategory": epr_category(s),
        "monoMaterial": is_mono(s),
        "recyclabilityIndex": recyclability_index(s),
        "applications": s.props.get("applications", []),
        "notes": s.props.get("notes"),
        "provenance": "prototype estimate",
    }


@router.get("/api/structures")
def list_structures(gas_mode: str | None = Query(None, alias="gasMode", pattern="^(barrier|breathable)$"),
                    db: Session = Depends(get_db)) -> dict:
    lib = load_library(db)
    return {"results": [structure_dict(s) for s in lib.structures if not gas_mode or s.gas_mode == gas_mode]}


@router.get("/api/structures/{structure_id}")
def structure_detail(structure_id: str, db: Session = Depends(get_db)) -> dict:
    lib = load_library(db)
    for s in lib.structures:
        if s.id == structure_id.upper():
            return structure_dict(s)
    raise ApiError("NOT_FOUND", "That structure isn't in the library.", 404)
