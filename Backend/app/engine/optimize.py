"""Layer 3: multi-objective choice over the feasible candidates.

The library is a few dozen discrete structures, so the Pareto front is enumerated
exactly (no genetic algorithm needed) and ranked with TOPSIS using the user's
priority weights (Blueprint Layer 3).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .evaluate import Evaluation

# (name, True if larger is better)
CRITERIA = (
    ("shelfLifeMargin", True),
    ("costInrPerPack", False),
    ("gCo2ePerPack", False),
    ("recyclabilityIndex", True),
    ("mechanicalIndex", True),
)


@dataclass
class Ranked:
    ev: Evaluation
    score: float
    pareto: bool


def criteria(ev: Evaluation) -> list[float]:
    return [
        min(ev.shelf.estimate / max(ev.target_days, 1), 2.0),
        ev.footprint.inr_per_pack,
        ev.footprint.g_co2e,
        float(ev.footprint.recyclability_index),
        ev.mech_index,
    ]


def weights(priorities: dict[str, float]) -> np.ndarray:
    sus = priorities.get("sustainability", 0.5)
    w = np.array([
        priorities.get("shelfLife", 0.5), priorities.get("cost", 0.5),
        sus / 2, sus / 2, priorities.get("mechanicalStrength", 0.5),
    ], dtype=float)
    total = w.sum()
    return w / total if total > 0 else np.full(len(w), 1 / len(w))


def pareto_mask(matrix: np.ndarray) -> np.ndarray:
    """Non-dominated rows, after flipping cost criteria so every column is 'larger is better'."""
    signs = np.array([1 if benefit else -1 for _, benefit in CRITERIA], dtype=float)
    m = matrix * signs
    n = len(m)
    mask = np.ones(n, dtype=bool)
    for i in range(n):
        dominated = np.all(m >= m[i], axis=1) & np.any(m > m[i], axis=1)
        if dominated.any():
            mask[i] = False
    return mask


def topsis(matrix: np.ndarray, w: np.ndarray) -> np.ndarray:
    norms = np.sqrt((matrix ** 2).sum(axis=0))
    norms[norms == 0] = 1.0
    v = matrix / norms * w
    benefit = np.array([b for _, b in CRITERIA])
    best = np.where(benefit, v.max(axis=0), v.min(axis=0))
    worst = np.where(benefit, v.min(axis=0), v.max(axis=0))
    d_best = np.sqrt(((v - best) ** 2).sum(axis=1))
    d_worst = np.sqrt(((v - worst) ** 2).sum(axis=1))
    denom = d_best + d_worst
    return np.where(denom > 0, d_worst / np.where(denom > 0, denom, 1), 1.0)


def rank(evs: list[Evaluation], priorities: dict[str, float]) -> list[Ranked]:
    """Rank candidates: TOPSIS score, with Pareto-optimal candidates ahead of dominated ones."""
    if not evs:
        return []
    matrix = np.array([criteria(e) for e in evs], dtype=float)
    scores = topsis(matrix, weights(priorities))
    front = pareto_mask(matrix)
    ranked = [Ranked(e, float(s), bool(p)) for e, s, p in zip(evs, scores, front)]
    ranked.sort(key=lambda r: (not r.pareto, -r.score))
    return ranked


def pick_alternatives(ranked: list[Ranked], limit: int = 3) -> list[tuple[str, Ranked]]:
    """Distinct trade-off profiles first (lowest cost, longest life, lowest footprint, strongest), then by rank."""
    if len(ranked) < 2:
        return []
    rec = ranked[0]
    pool = ranked[1:]
    chooser = [
        ("Lowest cost", lambda r: r.ev.footprint.inr_per_pack, min),
        ("Longest shelf life", lambda r: r.ev.shelf.estimate, max),
        ("Lowest footprint", lambda r: (r.ev.footprint.recyclability_index, -r.ev.footprint.g_co2e), max),
        ("Strongest", lambda r: r.ev.mech_index, max),
    ]
    picked: list[tuple[str, Ranked]] = []
    used = {rec.ev.structure.id}
    for label, key, fn in chooser:
        if len(picked) >= limit:
            break
        best_overall = fn(ranked, key=key)
        if best_overall is rec:
            continue  # the recommendation already owns this profile
        candidates = [r for r in pool if r.ev.structure.id not in used]
        if not candidates:
            break
        choice = fn(candidates, key=key)
        picked.append((label, choice))
        used.add(choice.ev.structure.id)
    for r in pool:
        if len(picked) >= limit:
            break
        if r.ev.structure.id not in used:
            picked.append(("Balanced alternative", r))
            used.add(r.ev.structure.id)
    return picked
