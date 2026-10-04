"""The nine pipeline stages of the frontend build spec §7.2, end to end.

1 ingest → 2 validate & normalise → 3 derive requirements → 4 filter candidates →
5 predict / score → 6 optimise → 7 explain → 8 alternatives → (9 export: report module)
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from .. import ENGINE_VERSION
from . import explain, optimize
from .context import Scenario, build_scenario
from .evaluate import Evaluation, evaluate, specifications, window_text
from .gatekeeper import check, parse_constraints
from .requirements import Requirements, derive
from .risks import assess
from .shelf_life import ShelfLife
from .types import PROV_MODEL, CommodityRecord, Library

# Optional ML hook: (scenario, evaluation) -> (days, relative band) or None.
Predictor = Callable[[Scenario, Evaluation], "tuple[float, float] | None"]


@dataclass
class Analysis:
    scenario: Scenario
    requirements: Requirements
    evaluations: list[Evaluation]
    result: dict


def prepare(request, record: CommodityRecord | None, library: Library) -> tuple[Scenario, Requirements]:
    sc = build_scenario(request, record, library.defaults)
    return sc, derive(sc, assess(sc))


def apply_predictor(ev: Evaluation, sc: Scenario, predictor: Predictor | None) -> None:
    if predictor is None:
        return
    out = predictor(sc, ev)
    if out:
        days, band = out
        ev.shelf = ShelfLife(days, ev.shelf.failure_mode, ev.shelf.mechanisms, provenance=PROV_MODEL, band=band)


def run(request, record: CommodityRecord | None, library: Library, predictor: Predictor | None = None) -> Analysis:
    sc, req = prepare(request, record, library)
    constraints, constraint_warnings = parse_constraints(sc.hard_constraints)
    warnings = sc.warnings + constraint_warnings

    evaluations: list[Evaluation] = []
    for structure in library.structures:
        ev = evaluate(structure, sc, req, library.defaults["costs"])
        apply_predictor(ev, sc, predictor)
        ev.violations = check(structure, sc, req, ev.footprint, constraints)
        evaluations.append(ev)

    passed = [e for e in evaluations if not e.violations]
    feasible = [e for e in passed if e.meets_target]
    fallback = False
    if feasible:
        pool = feasible
    elif passed:
        pool, fallback = passed, True
        warnings.append(f"No candidate reaches the {sc.target_days}-day target under these conditions; showing the closest options.")
    else:
        fewest = min(len(e.violations) for e in evaluations)
        pool, fallback = [e for e in evaluations if len(e.violations) == fewest], True
        warnings.append("Every candidate breaks at least one hard constraint; the least-violating structure is shown for review.")

    ranked = optimize.rank(pool, sc.priorities)
    rec = ranked[0].ev
    alt_picks = optimize.pick_alternatives(ranked)
    if not alt_picks and not fallback:
        # Offer the best near-miss so the user still sees a trade-off.
        near = optimize.rank([e for e in passed if e not in feasible], sc.priorities)
        alt_picks = [("Shorter shelf life", near[0])] if near else []

    if fallback:
        for row in rec.rows:
            if rec.violations:
                row["status"] = "REVIEW"

    rejected = []
    for e in evaluations:
        if e is rec or any(r.ev is e for _, r in alt_picks):
            continue
        if e.violations:
            rejected.append({"structure": e.structure.name, "structureId": e.structure.id, "stage": "hard-constraint", "reasons": e.violations})
        elif not e.meets_target:
            rejected.append({"structure": e.structure.name, "structureId": e.structure.id, "stage": "performance",
                             "reasons": [f"Estimated shelf life {explain._days(e.shelf.estimate)} days ({e.shelf.failure_mode}) "
                                         f"is below your {sc.target_days}-day target."]})
        else:
            rejected.append({"structure": e.structure.name, "structureId": e.structure.id, "stage": "optimisation",
                             "reasons": ["Feasible, but another candidate scored better for your priorities."]})
    rejected.sort(key=lambda r: {"performance": 0, "hard-constraint": 1, "optimisation": 2}[r["stage"]])

    confidence = sc.confidence
    conf_reasons = list(sc.confidence_reasons)
    if fallback:
        confidence = "prototype"
        conf_reasons.append("No candidate satisfied every requirement.")

    why = explain.why(sc, req, rec, rejected, fallback)
    result = {
        "engineVersion": ENGINE_VERSION,
        "freshProduceMode": req.produce is not None,
        "recommendation": {
            "structure": rec.structure.name,
            "structureId": rec.structure.id,
            "confidence": confidence,
            "profile": "Best balance for your priorities (TOPSIS)",
            "score": round(ranked[0].score, 3),
        },
        "requirements": rec.rows,
        "why": why,
        "alternatives": [
            {
                "structure": r.ev.structure.name,
                "structureId": r.ev.structure.id,
                "profile": label,
                "tradeoffSummary": explain.tradeoff(r.ev, rec, label, sc.target_days),
                "requirements": r.ev.rows,
                "shelfLife": {**r.ev.shelf.to_dict(), "targetDays": sc.target_days, "meetsTarget": r.ev.meets_target},
                "costAndImpact": r.ev.footprint.to_dict(),
                "score": round(r.score, 3),
            }
            for label, r in alt_picks
        ],
        "freshProduce": fresh_produce_block(sc, req, rec) if req.produce else None,
        "confidence": {"level": confidence, "reasons": conf_reasons},
        "risks": [r.to_dict() for r in req.risks],
        "specifications": specifications(rec, sc, req),
        "shelfLife": {**rec.shelf.to_dict(), "targetDays": sc.target_days, "meetsTarget": rec.meets_target},
        "costAndImpact": rec.footprint.to_dict(),
        "rejected": rejected,
        "warnings": warnings,
        "assumptions": sc.assumptions + [
            "Shelf-life, cost and footprint figures are prototype estimates (±30 % band) pending laboratory validation.",
        ],
        "inputsUsed": inputs_used(sc),
        "trace": trace(sc, req, evaluations, passed, feasible, len(why), len(alt_picks)),
    }
    return Analysis(sc, req, evaluations, result)


def fresh_produce_block(sc: Scenario, req: Requirements, rec: Evaluation) -> dict:
    p = req.produce
    perf = rec.perforation
    if req.gas_mode == "open":
        mode = "Open: ventilated pack (low respiration)"
    elif perf and perf.get("type") == "micro" and perf.get("required"):
        mode = f"Controlled: {perf['holesPerPack']} micro-perforations of {perf['diameterUm']} µm"
    else:
        mode = "Controlled (breathable film)"
    sourced = p.window_provenance == "source-backed"
    note = (f"O₂/CO₂ window is the published recommendation for {sc.name.lower()}; the equilibrium values are "
            "steady-state estimates to verify with headspace gas analysis."
            if sourced else
            "Gas composition values not validated for this scenario — showing configuration template only.")
    return {
        "gasExchangeRequirement": mode,
        "mapSuitable": bool(rec.gas and rec.gas["mapOk"]),
        "respirationRate": {"mlO2PerKgH": round(p.rate_nom, 1), "temperatureC": sc.temperature_c, "provenance": p.rate_provenance},
        "perforation": perf,
        "equilibrium": specifications(rec, sc, req).get("gasBalance"),
        "configTemplate": {
            "note": note,
            "o2Target": window_text(p.o2_window) if sourced and p.o2_window else None,
            "co2Target": window_text(p.co2_window) if sourced and p.co2_window else None,
        },
    }


def trace(sc: Scenario, req: Requirements, evaluations: list[Evaluation], passed: list[Evaluation],
          feasible: list[Evaluation], n_why: int, n_alts: int) -> list[dict]:
    """What each reasoning stage found, for the analysis screen (frontend build spec §6.5 / §7.5)."""
    known = sum(1 for p in sc.profile.values() if p.value is not None)
    top = max(req.risks, key=lambda r: r.severity, default=None)
    n = len(evaluations)
    return [
        {"stage": "profile", "detail": f"{sc.name}: {known} of {len(sc.profile)} food properties known"},
        {"stage": "risks", "detail": f"{len(req.risks)} risks assessed" + (f"; highest: {top.title.lower()} ({top.level})" if top else "")},
        {"stage": "requirements", "detail": f"{len(evaluations[0].rows) if evaluations else 0} packaging requirements set"},
        {"stage": "filter", "detail": f"{n} structures screened, {len(passed)} passed the hard checks"},
        {"stage": "score", "detail": (f"None reach the {sc.target_days}-day target; closest options ranked by your priorities"
                                      if not feasible else
                                      f"{len(feasible)} {'reaches' if len(feasible) == 1 else 'reach'} the {sc.target_days}-day target; "
                                      "ranked by your priorities")},
        {"stage": "explain", "detail": f"{n_why} reasons and {n_alts} alternatives prepared"},
    ]


def inputs_used(sc: Scenario) -> dict:
    return {
        "commodity": sc.name,
        "commodityId": sc.commodity_id,
        "category": sc.category,
        "profile": {k: p.wrapped() for k, p in sc.profile.items()},
        "engineParameters": {k: p.wrapped() for k, p in sc.extra.items()},
        "pack": {"netWeightG": sc.pack_mass_g, "areaM2": sc.pack_area_m2, "format": sc.pack_format, "provenance": sc.pack_provenance},
        "conditions": {"temperatureC": sc.temperature_c, "relativeHumidityPct": round(sc.rh * 100, 1), "storageType": sc.storage_type,
                       "targetShelfLifeDays": sc.target_days, "transportMode": sc.transport_mode, "transportStress": sc.transport_stress},
        "priorities": sc.priorities,
        "hardConstraints": sc.hard_constraints,
    }
