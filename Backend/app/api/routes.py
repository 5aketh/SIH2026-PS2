import json
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.config import settings
from app.ml.predictor import MLPredictor

router = APIRouter()

# Global predictor instance
_predictor: Optional[MLPredictor] = None


def get_predictor() -> MLPredictor:
    """Returns initialized ML predictor or raises HTTPException if model is missing."""
    global _predictor
    if _predictor is None:
        model_path = Path(settings.ml_artifact_path)
        if not model_path.exists():
            raise HTTPException(
                status_code=500,
                detail=f"ML model file is missing at path: {model_path.resolve()}. Train the model before serving requests."
            )
        _predictor = MLPredictor(model_path=str(model_path))
    return _predictor


def load_seed_structures() -> Dict[str, Dict[str, Any]]:
    """Loads and returns structure catalog indexed by ID. Throws HTTPException on failure."""
    struct_path = Path("app/data/structures.json")
    if not struct_path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Structure dataset missing at: {struct_path.resolve()}"
        )

    with open(struct_path, "r", encoding="utf-8") as f:
        structures_list = json.load(f)

    if not isinstance(structures_list, list) or not structures_list:
        raise HTTPException(
            status_code=500,
            detail="Structure catalog in structures.json is empty or malformed."
        )

    catalog = {}
    for item in structures_list:
        item_id = item.get("id")
        if not item_id:
            raise HTTPException(status_code=500, detail="Structure record missing required 'id' attribute.")
        catalog[item_id] = item

    return catalog


# Strict Pydantic Schemas for Request Body
class CommoditySpec(BaseModel):
    name: str
    moisture_pct: float
    fat_pct: float
    ph: float
    water_activity: float
    oxidation_sensitive: bool


class StorageConditions(BaseModel):
    temperature_c: float
    target_shelf_life_days: float
    relative_humidity_pct: float
    storage_type: str


class PriorityWeights(BaseModel):
    shelf_life: float
    cost: float
    sustainability: float
    mechanical_strength: float


class HardConstraints(BaseModel):
    must_be_recyclable: bool
    must_be_compostable: bool


class PrioritiesSpec(BaseModel):
    weights: PriorityWeights
    hard_constraints: HardConstraints


class RecommendationRequest(BaseModel):
    commodity: CommoditySpec
    conditions: StorageConditions
    priorities: PrioritiesSpec


@router.post("/recommend")
def generate_recommendation(scenario: RecommendationRequest):
    """
    POST endpoint for packaging recommendation.
    Infers optimal packaging laminate and predicted shelf life.
    """
    try:
        predictor = get_predictor()
        structures = load_seed_structures()
        recommendation = predictor.predict(scenario=scenario, seed_structures=structures)
        return recommendation
    except (ValueError, KeyError, FileNotFoundError, RuntimeError) as err:
        raise HTTPException(status_code=400, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(err)}")