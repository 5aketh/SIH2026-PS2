"""FastAPI entry point: `uvicorn app.main:app --reload` from the backend directory."""
import logging
from contextlib import asynccontextmanager

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import ENGINE_VERSION
from .api import analyze, commodities, evaluate, health, materials, report
from .config import BACKEND_DIR, get_settings
from .db.session import SessionLocal
from .errors import install_error_handlers
from .seed.loader import seed

log = logging.getLogger("packwise")


def migrate(database_url: str) -> None:
    """`alembic upgrade head` against the configured database, then the idempotent seed."""
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.attributes["database_url"] = database_url
    # Keep uvicorn's logging setup; alembic.ini's fileConfig would replace it.
    cfg.attributes["configure_logger"] = False
    command.upgrade(cfg, "head")
    with SessionLocal() as db:
        log.info("Seeded: %s", seed(db))


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    if settings.auto_migrate:
        migrate(settings.database_url)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="PackWise API", version=ENGINE_VERSION, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        expose_headers=["Content-Disposition"],
    )
    install_error_handlers(app)
    for module in (health, commodities, analyze, report, evaluate, materials):
        app.include_router(module.router)
    return app


app = create_app()
