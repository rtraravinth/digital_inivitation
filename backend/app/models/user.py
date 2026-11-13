"""The user, and the two one-to-one rows that make up an account."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.account import AccountProfile, AccountSettings
    from app.models.asset import Asset
    from app.models.auth_session import AuthSession
    from app.models.portfolio import Portfolio


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    # Stored lowercase; the service normalises before writing so the unique
    # index is a real "one account per address" guarantee. Nullable because
    # an account made with a phone number has no address at all.
    email: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True, index=True)
    # The Firebase uid this account signs in as. Firebase holds every
    # credential — FACET stores no password, second factor or recovery code.
    # Nullable only for an account made before Firebase (or by the CLI) that
    # has not signed in since; its first verified sign-in fills it.
    firebase_uid: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Every child cascades, so DELETE /account is one statement and leaves
    # nothing orphaned.
    profile: Mapped[AccountProfile] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )
    settings: Mapped[AccountSettings] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )
    sessions: Mapped[list[AuthSession]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    portfolios: Mapped[list[Portfolio]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    assets: Mapped[list[Asset]] = relationship(back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<User {self.email}>"
