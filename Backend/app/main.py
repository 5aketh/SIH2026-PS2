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
from .ml.train import train_and_save_model
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

    # 1. Run database migrations & seed loading if auto_migrate is enabled
    if settings.auto_migrate:
        migrate(settings.database_url)

    # 2. Automatically train ML model on boot if enabled and artifact is missing
    print(f"🤖 [Startup] ML Enabled: {settings.ml_enabled}")
    if settings.ml_enabled:
        model_path = settings.ml_artifact_path
        if not model_path.exists():
            print(f"🚀 [Startup] ML Model missing at {model_path}. Training...")
            try:
                train_and_save_model(output_path=model_path)
                print("✅ [Startup] Initial ML model training completed successfully.")
            except Exception as e:
                print(f"❌ [Startup] ML model training failed: {e}")
                raise RuntimeError(f"Startup ML model training failed: {str(e)}") from e
        else:
            print(f"✅ [Startup] Verified ML Model artifact at {model_path.resolve()}")

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