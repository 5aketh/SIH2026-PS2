import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import ENGINE_VERSION
from ..db.models import Analysis
from ..db.session import get_db
from ..engine.context import ScenarioError
from ..engine.pipeline import run
from ..errors import ApiError
from ..ml.predictor import get_predictor
from ..repo import get_commodity, load_library
from ..schemas.analyze import AnalyzeRequest

router = APIRouter(tags=["analysis"])


def scenario_error(exc: ScenarioError) -> ApiError:
    return ApiError("VALIDATION_ERROR", exc.message, 422, exc.field)


@router.post("/api/analyze")
def analyze(body: AnalyzeRequest, db: Session = Depends(get_db)) -> dict:
    record = get_commodity(db, body.commodity.commodity_id) if body.commodity.commodity_id else None
    try:
        analysis = run(body, record, load_library(db), get_predictor())
    except ScenarioError as exc:
        raise scenario_error(exc) from exc
    analysis_id = "an_" + uuid.uuid4().hex[:12]
    result = {"analysisId": analysis_id, **analysis.result}
    db.add(Analysis(id=analysis_id, engine_version=ENGINE_VERSION,
                    request=body.model_dump(by_alias=True, mode="json"), result=result))
    db.commit()
    return result


@router.get("/api/analyses/{analysis_id}")
def stored(analysis_id: str, db: Session = Depends(get_db)) -> dict:
    row = db.get(Analysis, analysis_id)
    if row is None:
        raise ApiError("NOT_FOUND", "That analysis wasn't found. Run the analysis again.", 404)
    return {"request": row.request, "result": row.result, "createdAt": row.created_at.isoformat()}
