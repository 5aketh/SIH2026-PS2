from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..db.models import Analysis, Material
from ..db.session import get_db
from ..errors import ApiError
from ..report import render_pdf

router = APIRouter(tags=["report"])


@router.get("/api/report/{analysis_id}")
def report(analysis_id: str, format: Literal["pdf"] = Query("pdf"), db: Session = Depends(get_db)) -> Response:
    row = db.get(Analysis, analysis_id)
    if row is None:
        raise ApiError("NOT_FOUND", "That analysis wasn't found. Run the analysis again to export a report.", 404)
    names = {m.id: m.name for m in db.query(Material).all()}
    pdf = render_pdf(row.id, row.request, row.result, row.created_at, names)
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="packwise-report-{row.id}.pdf"'},
    )
