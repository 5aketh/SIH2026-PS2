from app.config import settings
from app.ml.predictor import MLPredictor

# Initialize predictor singleton
ml_predictor = MLPredictor(settings.ML_ARTIFACT_PATH)

def run_analysis(scenario, seed_data: dict) -> dict:
    """
    Main analysis entry point called by POST /api/analyze.
    Routes to ML predictor if enabled, otherwise falls back to physics engine.
    """
    if settings.ML_ENABLED and ml_predictor.is_ready():
        return ml_predictor.predict(scenario, seed_data.get("structures", {}))

    # Standard physics- & rule-based pipeline fallback
    return run_physics_pipeline(scenario, seed_data)

def run_physics_pipeline(scenario, seed_data: dict) -> dict:
    """
    Standard decision engine pipeline (physics calculations, gatekeeper checks, TOPSIS).
    """
    # Existing physics-based pipeline implementation...
    pass