"""Settings, read once from the environment and cached.

Everything configurable lives here. No module reads ``os.environ`` directly —
a setting that is not on ``Settings`` is not a setting, it is a constant, and
belongs next to the code that uses it.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]

Env = Literal["dev", "test", "prod"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_prefix="FACET_",
        extra="ignore",
        case_sensitive=False,
    )

    env: Env = "dev"

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/facet"
    test_database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/facet_test"
    )

    jwt_secret: str = "insecure-development-secret-do-not-ship"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = Field(default=15, ge=1, le=60 * 24)
    refresh_token_ttl_days: int = Field(default=30, ge=1, le=365)
    # How long a two-step login challenge stays usable.
    challenge_ttl_seconds: int = Field(default=300, ge=30, le=3600)
    # How long a signed upload URL keeps opening. Longer than an access
    # token on purpose: the URL is baked into a response the editor may
    # hold on screen for hours, and it names one asset and nothing else.
    asset_url_ttl_minutes: int = Field(default=60 * 24, ge=5, le=60 * 24 * 30)

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    public_base_url: str = "http://localhost:8000"

    media_root: Path = Path("media")

    @field_validator("media_root")
    @classmethod
    def _resolve_media_root(cls, value: Path) -> Path:
        """Relative media paths resolve against the backend directory.

        Otherwise the upload location would depend on the shell's working
        directory, which is how uploads end up scattered across a repo.
        """
        return value if value.is_absolute() else (BACKEND_DIR / value)

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"

    @property
    def sync_database_url(self) -> str:
        """The same database, for the one caller that cannot be async.

        Alembic's ``run_sync`` path and the test harness's CREATE DATABASE
        both need a driver that speaks blocking DBAPI.
        """
        return self.database_url.replace("+asyncpg", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()
