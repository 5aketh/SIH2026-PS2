from pathlib import Path
from typing import Any
import joblib
import numpy as np
from app.config import get_settings


class PackagingPredictor:
    """Wrapper class for managing and serving the trained ML models."""

    def __init__(self, model_path: Path):
        if not model_path.exists():
            raise FileNotFoundError(
                f"Model artifact not found at {model_path.resolve()}"
            )

        artifact = joblib.load(model_path)

        if isinstance(artifact, dict):
            self.classifier = artifact.get("classifier")
            self.regressor = artifact.get("regressor")
            self.version = artifact.get("version", "1.0.0")
        else:
            self.regressor = artifact
            self.classifier = None
            self.version = "1.0.0"

    def _unwrap_val(self, val: Any, default: float = 0.0) -> float:
        """Recursively unpacks float values from primitives, Param objects, dicts, or strings."""
        if val is None:
            return default

        # Primitive int / float
        if isinstance(val, (int, float)):
            return float(val)

        # Numeric string
        if isinstance(val, str):
            try:
                return float(val)
            except ValueError:
                return default

        # Dictionary: e.g. {"value": 94.0, "unit": "%"} or {"val": 94.0}
        if isinstance(val, dict):
            for key in ("value", "val", "numeric_value", "amount", "default"):
                if key in val:
                    return self._unwrap_val(val[key], default)
            return default

        # Objects / Param instances: e.g. Param(value=94.0) or Param(val=94.0)
        for attr in ("value", "val", "numeric_value", "amount", "default"):
            if hasattr(val, attr):
                inner = getattr(val, attr)
                if inner is not None and inner != val:
                    return self._unwrap_val(inner, default)

        try:
            return float(val)
        except (TypeError, ValueError):
            return default

    def _get_val(self, obj: Any, *keys: str, default: Any = None) -> Any:
        """Helper to extract attribute or dictionary key gracefully."""
        if obj is None:
            return default

        for key in keys:
            # Check object attribute access
            if hasattr(obj, key):
                val = getattr(obj, key)
                if val is not None:
                    return val
            # Check dictionary key access
            if isinstance(obj, dict) and key in obj:
                val = obj[key]
                if val is not None:
                    return val
        return default

    def extract_features(self, sc: Any, ev: Any = None) -> list[float]:
        """Extracts 16-element feature vector matching train.py schema."""
        # Extract commodity profile
        commodity = self._get_val(sc, "commodity", default=sc)
        profile = self._get_val(commodity, "profile", default=commodity)

        moisture = self._unwrap_val(
            self._get_val(profile, "moisturePct", "moisture_pct", "moisture"),
            default=10.0,
        )
        fat = self._unwrap_val(
            self._get_val(profile, "fatPct", "fat_pct", "fat"), default=1.0
        )
        ph = self._unwrap_val(
            self._get_val(profile, "ph", "pH"), default=6.0
        )

        # Water activity (safely unwrapped)
        aw_val = self._get_val(
            profile, "waterActivity", "water_activity", "aw", default=None
        )
        if aw_val is not None:
            aw = self._unwrap_val(aw_val, default=0.7)
        else:
            aw = min(0.99, max(0.10, moisture / 100.0))

        ox = 1.0 if fat > 10.0 else 0.0

        # Extract storage conditions
        conditions = self._get_val(sc, "conditions", default=sc)

        temp = self._unwrap_val(
            self._get_val(conditions, "temperatureC", "temperature_c", "temp"),
            default=20.0,
        )
        target = self._unwrap_val(
            self._get_val(
                conditions, "targetShelfLifeDays", "target_days", "targetDays"
            ),
            default=14.0,
        )
        rh = self._unwrap_val(
            self._get_val(
                conditions, "relativeHumidityPct", "relative_humidity_pct", "rh"
            ),
            default=75.0,
        )

        is_chilled = 1.0 if temp <= 10.0 else 0.0
        is_frozen = 1.0 if temp < 0.0 else 0.0

        features = [
            moisture,
            fat,
            ph,
            aw,
            ox,
            temp,
            target,
            rh,
            is_chilled,
            is_frozen,
            0.5,
            0.5,
            0.5,
            0.5,
            0.0,
            0.0,
        ]
        return features

    def predict_shelf_life(self, features: list | np.ndarray) -> float:
        """Predicts shelf life in days."""
        if self.regressor is None:
            raise ValueError("Regressor model is not loaded in artifact.")

        X = np.array(features)
        if X.ndim == 1:
            X = X.reshape(1, -1)

        preds = self.regressor.predict(X)
        return float(preds[0])

    def predict_structure(self, features: list | np.ndarray) -> str:
        """Predicts recommended packaging structure ID (e.g., 'STR-05')."""
        if self.classifier is None:
            raise ValueError("Classifier model is not loaded in artifact.")

        X = np.array(features)
        if X.ndim == 1:
            X = X.reshape(1, -1)

        preds = self.classifier.predict(X)
        return str(preds[0])

    def predict(self, features: list | np.ndarray) -> dict:
        """Returns predictions for both structure and shelf life."""
        result = {}
        if self.classifier:
            result["structure"] = self.predict_structure(features)
        if self.regressor:
            result["shelf_life"] = self.predict_shelf_life(features)
        return result

    def __call__(self, sc: Any, ev: Any = None) -> tuple[float, float]:
        """Allows pipeline.apply_predictor(ev, sc, predictor) to call the instance directly.

        Returns (days, band) tuple expected by pipeline unpacking logic.
        """
        features = self.extract_features(sc, ev)
        days = self.predict_shelf_life(features)
        band = 0.30  # Default ±30% uncertainty/confidence margin
        return days, band


_predictor_instance = None


def get_predictor() -> PackagingPredictor:
    """Returns a singleton instance of PackagingPredictor."""
    global _predictor_instance
    if _predictor_instance is None:
        settings = get_settings()
        model_path = Path(settings.ml_artifact_path)
        _predictor_instance = PackagingPredictor(model_path)
    return _predictor_instance