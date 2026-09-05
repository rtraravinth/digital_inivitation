"""Account settings.

``AccountOut`` mirrors ``AccountSettings`` in src/lib/types.ts field for
field, so the Account page consumes it with no mapping layer.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import EmailStr, Field, field_validator

from app.models.enums import PlanId
from app.schemas.asset import AssetOut
from app.schemas.common import CamelModel, StrictCamelModel

HANDLE_PATTERN = r"^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$"


class LinkItem(StrictCamelModel):
    id: str = Field(max_length=64)
    label: str = Field(default="", max_length=200)
    url: str = Field(default="", max_length=2000)


class ProfileOut(CamelModel):
    name: str
    handle: str | None
    current: str
    about: str
    tags: list[str]
    links: list[LinkItem]
    portrait: AssetOut | None


class SecurityOut(CamelModel):
    """Never carries a secret or a hash — not the TOTP seed, not a code."""

    email: EmailStr
    phone: str
    password_changed: datetime | None
    two_step: bool
    google: bool
    recovery_codes_remaining: int


class AccountOut(CamelModel):
    profile: ProfileOut
    security: SecurityOut
    plan: PlanId
    custom_domain: str
    notifications: dict[str, bool]
    privacy: dict[str, bool]


class ProfilePatch(StrictCamelModel):
    name: str | None = Field(default=None, max_length=200)
    handle: str | None = Field(default=None, pattern=HANDLE_PATTERN)
    current: str | None = Field(default=None, max_length=2000)
    about: str | None = Field(default=None, max_length=5000)
    tags: list[str] | None = Field(default=None, max_length=40)
    links: list[LinkItem] | None = Field(default=None, max_length=40)
    portrait_asset_id: uuid.UUID | None = None
    # Distinguishes "leave the portrait alone" from "remove it": the id field
    # alone cannot, because null is a legitimate value for both.
    clear_portrait: bool = False


class SecurityPatch(StrictCamelModel):
    phone: str | None = Field(default=None, max_length=32)
    google: bool | None = None


class PlanPatch(StrictCamelModel):
    plan: PlanId


class DomainPatch(StrictCamelModel):
    custom_domain: str = Field(default="", max_length=255)

    @field_validator("custom_domain")
    @classmethod
    def _tidy(cls, value: str) -> str:
        return value.strip().lower().removeprefix("https://").removeprefix("http://").strip("/")


class NotificationsPatch(StrictCamelModel):
    """Every key optional, unknown keys rejected.

    A misspelled key silently ignored looks exactly like a save that did
    nothing, which is the worst possible outcome for a settings toggle.
    """

    booking: bool | None = None
    weekly: bool | None = None
    broken_link: bool | None = None
    mention: bool | None = None
    product: bool | None = None


class PrivacyPatch(StrictCamelModel):
    indexable: bool | None = None
    show_contact: bool | None = None
    count_visits: bool | None = None
    badge: bool | None = None
