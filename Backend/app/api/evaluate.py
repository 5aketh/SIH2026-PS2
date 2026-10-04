"""Package Builder and What-If simulator (Features Report §2-3).

Both reuse the analysis engine: the same requirements, the same Layer 2 evaluation
and the same hard-constraint checks, applied to one structure at a time.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..engine.context import ScenarioError
from ..engine.evaluate import Evaluation, evaluate, specifications
from ..engine.gatekeeper import check, parse_constraints
from ..engine.pipeline import apply_predictor, prepare, run
from ..engine.types import LayerSpec, Library, StructureSpec
from ..errors import ApiError
from ..ml.predictor import get_predictor
from ..repo import get_commodity, load_library
from ..schemas.analyze import AnalyzeRequest
from ..schemas.evaluate import EvaluateRequest, StructureIn, WhatIfRequest
from .analyze import scenario_error

router = APIRouter(tags=["builder"])


def resolve_structure(spec: StructureIn, lib: Library, produce: bool, field: str) -> StructureSpec:
    if spec.structure_id:
        for s in lib.structures:
            if s.id == spec.structure_id.upper():
                return s
        raise ApiError("VALIDATION_ERROR", f"Structure '{spec.structure_id}' isn't in the library.", 422, f"{field}.structureId")
    layers = []
    n = len(spec.layers)
    for i, layer in enumerate(spec.layers):
        m = lib.materials.get(layer.material_id.upper())
        if m is None:
            raise ApiError("VALIDATION_ERROR", f"Material '{layer.material_id}' isn't in the knowledge base.", 422,
                           f"{field}.layers.{i}.materialId")
        fn = layer.function or ("seal" if i == n - 1 else "barrier" if m.barrier_ply else "print" if i == 0 else "structural")
        layers.append(LayerSpec(m, layer.thickness_um, fn))
    perforation = spec.perforation or "none"
    # As in the library: perforated films breathe; laminates and barrier, metallised or foil plies seal;
    # a single plain film is a produce bag for respiring food and a sealed pouch otherwise.
    sealed = len(layers) > 1 or any(l.material.barrier_ply or l.material.metallized or l.material.non_plastic for l in layers)
    gas_mode = "breathable" if perforation != "none" or (produce and not sealed) else "barrier"
    name = spec.name or " / ".join(f"{l.material.name} {l.thickness_um:g} µm" for l in layers)
    return StructureSpec(id="CUSTOM", name=name, gas_mode=gas_mode, perforation=perforation, layers=layers)


def _barrier_class(value: float, high: float, medium: float) -> str:
    return "high" if value < high else "medium" if value < medium else "low"


def indicators(ev: Evaluation, sc, req) -> dict:
    fp = ev.footprint
    return {
        "structure": {"structureId": ev.structure.id, "name": ev.structure.name, "totalGaugeUm": ev.structure.total_gauge_um},
        "indicators": {
            "shelfLife": {**ev.shelf.to_dict(), "targetDays": sc.target_days, "meetsTarget": ev.meets_target},
            "costInrPerPack": round(fp.inr_per_pack, 2),
            "costBand": fp.cost_band,
            "barrier": {
                "oxygen": _barrier_class(ev.otr_test, 5, 200),
                "moisture": _barrier_class(ev.wvtr_test, 2, 10),
                "otrTest": float(f"{ev.otr_test:.2g}"),
                "wvtrTest": float(f"{ev.wvtr_test:.2g}"),
            },
            "sustainability": {"gCo2ePerPack": round(fp.g_co2e, 1), "eprCategory": fp.epr_category,
                               "recyclabilityIndex": fp.recyclability_index, "recyclable": fp.recyclable},
            "mechanicalIndex": round(ev.mech_index),
            "provenance": "prototype estimate",
        },
        "requirements": ev.rows,
        "violations": ev.violations,
        "specifications": specifications(ev, sc, req),
    }


def evaluate_side(scenario: AnalyzeRequest, structure: StructureIn | None, db: Session, lib: Library, field: str):
    record = get_commodity(db, scenario.commodity.commodity_id) if scenario.commodity.commodity_id else None
    try:
        sc, req = prepare(scenario, record, lib)
        if structure is None:
            rec_id = run(scenario, record, lib, get_predictor()).result["recommendation"]["structureId"]
            s = next(x for x in lib.structures if x.id == rec_id)
        else:
            s = resolve_structure(structure, lib, sc.is_produce, field)
    except ScenarioError as exc:
        raise scenario_error(exc) from exc
    constraints, _ = parse_constraints(sc.hard_constraints)
    ev = evaluate(s, sc, req, lib.defaults["costs"])
    apply_predictor(ev, sc, get_predictor())
    ev.violations = check(s, sc, req, ev.footprint, constraints)
    return sc, req, ev


@router.post("/api/evaluate")
def evaluate_structure(body: EvaluateRequest, db: Session = Depends(get_db)) -> dict:
    lib = load_library(db)
    sc, req, ev = evaluate_side(body.scenario, body.structure, db, lib, "structure")
    return indicators(ev, sc, req)


CHANGES = (
    ("Estimated shelf life (days)", lambda d: d["shelfLife"]["estimateDays"], True),
    ("Packaging cost (₹/pack)", lambda d: d["costInrPerPack"], False),
    ("Oxygen barrier", lambda d: d["barrier"]["oxygen"], None),
    ("Moisture barrier", lambda d: d["barrier"]["moisture"], None),
    ("Carbon footprint (g CO₂e/pack)", lambda d: d["sustainability"]["gCo2ePerPack"], False),
    ("Recyclability index", lambda d: d["sustainability"]["recyclabilityIndex"], True),
    ("Mechanical index", lambda d: d["mechanicalIndex"], True),
)
CLASS_RANK = {"low": 0, "medium": 1, "high": 2}


def _direction(before, after, higher_is_better) -> str:
    if before == after:
        return "same"
    if higher_is_better is None:
        higher_is_better, before, after = True, CLASS_RANK[before], CLASS_RANK[after]
    better = after > before if higher_is_better else after < before
    return "better" if better else "worse"


@router.post("/api/what-if")
def what_if(body: WhatIfRequest, db: Session = Depends(get_db)) -> dict:
    lib = load_library(db)
    base_scenario = body.baseline.scenario
    sc0, req0, ev0 = evaluate_side(base_scenario, body.baseline.structure, db, lib, "baseline.structure")
    # The variant keeps the baseline structure unless it names its own.
    var_structure = body.variant.structure
    if var_structure is None:
        var_structure = body.baseline.structure if ev0.structure.id == "CUSTOM" else StructureIn(structure_id=ev0.structure.id)
    var_scenario = body.variant.scenario or base_scenario
    sc1, req1, ev1 = evaluate_side(var_scenario, var_structure, db, lib, "variant.structure")

    before, after = indicators(ev0, sc0, req0), indicators(ev1, sc1, req1)
    changes = []
    for label, get, hib in CHANGES:
        b, a = get(before["indicators"]), get(after["indicators"])
        changes.append({"indicator": label, "before": b, "after": a, "direction": _direction(b, a, hib)})

    out = {"before": before, "after": after, "changes": changes}
    if body.variant.scenario is not None:
        record = get_commodity(db, var_scenario.commodity.commodity_id) if var_scenario.commodity.commodity_id else None
        rec = run(var_scenario, record, lib, get_predictor()).result["recommendation"]
        out["variantRecommendation"] = {"structure": rec["structure"], "structureId": rec["structureId"],
                                        "changed": rec["structureId"] != ev0.structure.id}
    return out
