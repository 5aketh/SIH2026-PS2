from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str = f"sqlite:///{(BACKEND_DIR / 'packwise.db').as_posix()}"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
    ]
    # Run `alembic upgrade head` and the idempotent seed loader on startup.
    auto_migrate: bool = True
    # The shelf-life model only replaces the rule estimate when enabled AND an artifact exists.
    ml_enabled: bool = False
    ml_artifact_path: Path = BACKEND_DIR / "artifacts" / "shelf_life_gbr.joblib"


@lru_cache
def get_settings() -> Settings:
    return Settings()
