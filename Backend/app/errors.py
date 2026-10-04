"""Every error leaves the API as {"error": {code, message, field}} (frontend build spec §7.4)."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("packwise")

# Friendly names for request fields, keyed by contract path.
FIELD_LABELS = {
    "commodity.profile.moisturePct": "Moisture",
    "commodity.profile.fatPct": "Fat",
    "commodity.profile.ph": "pH",
    "commodity.profile.respirationClass": "Respiration class",
    "commodity.profile.oxidationSensitivity": "Oxidation sensitivity",
    "commodity.profile.category": "Category",
    "commodity.commodityName": "Commodity name",
    "conditions.storageType": "Storage type",
    "conditions.temperatureC": "Storage temperature",
    "conditions.relativeHumidityPct": "Relative humidity",
    "conditions.targetShelfLifeDays": "Target shelf life",
    "conditions.transportMode": "Transport mode",
    "conditions.transportStress": "Transport stress",
}


class ApiError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, field: str | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.field = field


def error_body(code: str, message: str, field: str | None = None) -> dict:
    return {"error": {"code": code, "message": message, "field": field}}


def _contract_path(loc: tuple) -> str:
    parts = [str(p) for p in loc if p not in ("body", "query", "path")]
    return ".".join(parts)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError):
        return JSONResponse(error_body(exc.code, exc.message, exc.field), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        field = _contract_path(tuple(first.get("loc", ()))) or None
        label = FIELD_LABELS.get(field or "", field or "Request")
        msg = str(first.get("msg", "Invalid value")).removeprefix("Value error, ")
        return JSONResponse(error_body("VALIDATION_ERROR", f"{label}: {msg}", field), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
        return JSONResponse(error_body(code, str(exc.detail)), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception):
        log.exception("Unhandled error", exc_info=exc)
        return JSONResponse(error_body("SERVER_ERROR", "The analysis service hit an unexpected error."), status_code=500)
