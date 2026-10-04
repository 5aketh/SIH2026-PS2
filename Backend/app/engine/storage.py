"""Which storage a food can physically take. Scenarios outside it are rejected before analysis.

Rules come from the seed data, not code: a category's `storage` block in
category_defaults.json (allowed storage types and why the others are excluded),
an optional per-food `allowedStorage` param that overrides the category list,
and the catalog's source-backed `chillThresholdC` as the lowest safe temperature.
"""
from __future__ import annotations

from .types import CommodityRecord

STORAGE_LABELS = {"ambient": "Ambient", "chilled": "Chilled", "frozen": "Frozen"}
ALL_TYPES = list(STORAGE_LABELS)


def rule(category: str, record: CommodityRecord | None, defaults: dict, name: str) -> dict:
    """The resolved rule for one food: allowed storage types, minimum temperature, and the messages to show."""
    cats = defaults["categories"]
    cat = (cats.get(category) or cats["other"]).get("storage", {})
    allowed = list(cat.get("allowed", ALL_TYPES))
    messages = {k: v.replace("{name}", name) for k, v in cat.get("messages", {}).items()}

    if record is not None:
        own = record.get("allowedStorage")
        if own is not None and own.value:
            allowed = list(own.value)
        chill = record.get("chillThresholdC")
        if chill is not None and chill.value is not None:
            t = chill.value
            return {
                "allowedStorage": allowed,
                "minTemperatureC": t,
                "messages": {
                    **messages,
                    "minTemperature": f"{name} suffers chilling injury below {t:g} °C, so it has to be stored at {t:g} °C or warmer.",
                },
            }
    return {"allowedStorage": allowed, "minTemperatureC": None, "messages": messages}


def problem(r: dict, name: str, storage_type: str, temperature_c: float) -> tuple[str, str] | None:
    """(field, message) when the conditions break the rule, else None."""
    if storage_type not in r["allowedStorage"]:
        message = r["messages"].get(storage_type) or f"{STORAGE_LABELS[storage_type]} storage isn't supported for {name}."
        return "conditions.storageType", message
    if r["minTemperatureC"] is not None and temperature_c < r["minTemperatureC"]:
        return "conditions.temperatureC", r["messages"]["minTemperature"]
    return None


def table(records: list[CommodityRecord], defaults: dict) -> dict:
    """Every rule, for the frontend to check inputs before asking for an analysis.

    Category rules keep a literal "{name}" in their messages for custom foods.
    """
    return {
        "categories": {cat: rule(cat, None, defaults, "{name}") for cat in defaults["categories"]},
        "commodities": {r.id: rule(r.category, r, defaults, r.name) for r in records},
    }
