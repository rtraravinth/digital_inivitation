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
    test_database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/facet_test"

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
    # Outside production, any private-network origin on the dev server's port
    # is also allowed. The frontend is opened from this machine's LAN address
    # to test on a phone, and the router hands that address out by DHCP, so a
    # fixed list goes stale — and a refused origin fails silently: the page
    # loads, but every view and click it reports is dropped by CORS and the
    # owner's stats read zero. Off in prod, where origins are listed outright.
    cors_dev_lan: bool = True
    public_base_url: str = "http://localhost:8000"

    media_root: Path = Path("media")

    @property
    def cors_origin_regex(self) -> str | None:
        """Private-network origins on :3000, in dev and test only."""
        if self.is_prod or not self.cors_dev_lan:
            return None
        return (
            r"^https?://("
            r"192\.168\.\d{1,3}\.\d{1,3}"
            r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
            r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
            r"):3000$"
        )

    @field_validator("database_url", "test_database_url")
    @classmethod
    def _use_asyncpg(cls, value: str) -> str:
        """Accept the URL a host hands out as it is.

        Managed Postgres gives ``postgres://`` or ``postgresql://``; this
        app's engine is asyncpg and needs the driver named. Rewriting it here
        means the deployment can pass the host's own connection string
        through rather than someone editing it by hand.
        """
        for scheme in ("postgres://", "postgresql://"):
            if value.startswith(scheme):
                return "postgresql+asyncpg://" + value[len(scheme) :]
        return value

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
