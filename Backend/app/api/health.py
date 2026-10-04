from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import ENGINE_VERSION
from ..db.models import Commodity, Structure
from ..db.session import get_db
from ..ml.predictor import get_predictor

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health(db: Session = Depends(get_db)) -> dict:
    return {
        "status": "ok",
        "engineVersion": ENGINE_VERSION,
        "commodities": db.scalar(select(func.count()).select_from(Commodity)),
        "structures": db.scalar(select(func.count()).select_from(Structure)),
        "shelfLifeModel": "enabled" if get_predictor() else "rules only",
    }
