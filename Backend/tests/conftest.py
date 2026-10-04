"""Every test session runs against a fresh SQLite file, migrated and seeded by the app's own startup."""
import os
import tempfile
from pathlib import Path

import pytest

# Must be set before app modules build their settings and engine.
_DB = Path(tempfile.mkdtemp(prefix="packwise-test-")) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB.as_posix()}"
os.environ["AUTO_MIGRATE"] = "true"
os.environ["ML_ENABLED"] = "false"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def scenario(commodity_id="TOMATO_GENERIC", name="Tomato", **conditions) -> dict:
    """A valid POST /api/analyze body; profile fields come from the catalog record."""
    return {
        "commodity": {"commodityId": commodity_id, "commodityName": name, "isCustom": False, "profile": {}},
        "conditions": {
            "storageType": "chilled", "temperatureC": 12, "relativeHumidityPct": 85, "targetShelfLifeDays": 20,
            "transportMode": "refrigerated_transport", "transportStress": "medium", **conditions,
        },
        "priorities": {"shelfLife": 0.8, "cost": 0.4, "sustainability": 0.7, "mechanicalStrength": 0.5, "hardConstraints": []},
    }
