"""Snapshot real engine output into the frontend's demo-mode fixtures.

    python scripts/export_fixtures.py          (from backend/)

Writes src/mocks/fixtures/*.json so the app's mock API (used when
VITE_API_BASE_URL is unset) returns exactly what this backend would. Re-run it
after changing the engine or the seed data. Uses a throwaway SQLite database.
"""
import json
import os
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
OUT = BACKEND.parent / "src" / "mocks" / "fixtures"

os.environ["DATABASE_URL"] = f"sqlite:///{(Path(tempfile.mkdtemp()) / 'fixtures.db').as_posix()}"
os.environ["AUTO_MIGRATE"] = "true"
sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

PRIORITIES = {"shelfLife": 0.8, "cost": 0.4, "sustainability": 0.7, "mechanicalStrength": 0.5, "hardConstraints": []}

# One demo analysis per mock branch (fresh produce, dry/snack, everything else), as in build spec §9.
ANALYSES = {
    "fresh_produce": ("TOMATO_GENERIC", {"storageType": "chilled", "temperatureC": 12, "relativeHumidityPct": 85,
                                         "targetShelfLifeDays": 20, "transportMode": "refrigerated_transport", "transportStress": "medium"}),
    "dry": ("POTATO_CHIPS", {"storageType": "ambient", "temperatureC": 30, "relativeHumidityPct": 75,
                             "targetShelfLifeDays": 120, "transportMode": "ambient_transport", "transportStress": "high"}),
    "generic": ("PANEER_FRESH", {"storageType": "chilled", "temperatureC": 4, "relativeHumidityPct": 80,
                                 "targetShelfLifeDays": 14, "transportMode": "refrigerated_transport", "transportStress": "medium"}),
}


def ok(response) -> dict:
    response.raise_for_status()
    return response.json()


def write(name: str, data) -> None:
    path = OUT / name
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(BACKEND.parent)} ({path.stat().st_size // 1024} KB)")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with TestClient(app) as c:
        index = ok(c.get("/api/commodities", params={"query": ""}))["results"]
        write("commodities.json", [ok(c.get(f"/api/commodities/{x['commodityId']}")) for x in index])
        write("storage_rules.json", ok(c.get("/api/storage-rules")))

        analyses = {}
        for key, (commodity_id, conditions) in ANALYSES.items():
            body = {"commodity": {"commodityId": commodity_id, "isCustom": False, "profile": {}},
                    "conditions": conditions, "priorities": PRIORITIES}
            result = ok(c.post("/api/analyze", json=body))
            result.pop("analysisId")  # the mock mints its own
            analyses[key] = result
        write("analyses.json", analyses)

        materials = ok(c.get("/api/materials"))
        details = {m["materialId"]: ok(c.get(f"/api/materials/{m['materialId']}")) for m in materials["results"]}
        write("materials.json", {"families": materials["families"], "details": details})
        write("structures.json", ok(c.get("/api/structures"))["results"])


if __name__ == "__main__":
    main()
