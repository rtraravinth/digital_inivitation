"""Account profile and settings."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import PLANS, sql_in

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.user import User


def default_notifications() -> dict[str, bool]:
    """Matches ``defaultAccount()`` in src/lib/types.ts."""
    return {"booking": True, "weekly": True, "brokenLink": True, "mention": False, "product": False}


def default_privacy() -> dict[str, bool]:
    """Matches ``defaultAccount()`` in src/lib/types.ts.

    All four are read by the published page, so all four start permissive
    and every one of them actually changes what renders.
    """
    return {"indexable": True, "showContact": True, "countVisits": True, "badge": True}


class AccountProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "account_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    # Nullable so two accounts without a handle do not collide on "".
    handle: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    current: Mapped[str] = mapped_column(Text, nullable=False, default="")
    about: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    links: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    portrait_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped[User] = relationship(back_populates="profile")
    portrait: Mapped[Asset | None] = relationship(lazy="selectin")


class AccountSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "account_settings"
    __table_args__ = (CheckConstraint(f"plan IN ({sql_in(PLANS)})", name="plan_is_known"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    plan: Mapped[str] = mapped_column(String(16), nullable=False, default="free")
    custom_domain: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    notifications: Mapped[dict[str, bool]] = mapped_column(
        JSONB, nullable=False, default=default_notifications
    )
    privacy: Mapped[dict[str, bool]] = mapped_column(JSONB, nullable=False, default=default_privacy)

    phone: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    google_linked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    #: How this account last signed in, as Firebase names it: ``password``,
    #: ``google.com``, ``github.com``, ``emailLink`` or ``phone``. Shown on
    #: /account; never a credential.
    #: The server default is the one migration c4f1e8a2d6b9 created, so rows
    #: that predate the column read as "".
    sign_in_provider: Mapped[str] = mapped_column(
        String(32), nullable=False, default="", server_default=""
    )

    user: Mapped[User] = relationship(back_populates="settings")
