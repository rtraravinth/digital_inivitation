"""A portfolio, its header, and its sections.

One page per portfolio: a header, then N sections that all share the same four
fields. The ordered value lists (tags, links, numbers, dates, quote, layout)
are JSONB — they are always read with their parent and never queried across
rows, so a table each would buy nothing but joins.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import (
    BLOCK_KINDS,
    DEFAULT_ACCENT,
    DEFAULT_TRACKING,
    FONTS,
    GROUNDS,
    STATUSES,
    THEMES,
    sql_in,
)

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.user import User


def default_layout() -> dict[str, Any]:
    """Matches ``defaultLayout()`` in src/lib/types.ts."""
    return {
        "roleNav": "tabs",
        "grid": 2,
        "density": "standard",
        "scale": "default",
        "tracking": DEFAULT_TRACKING,
    }


class Portfolio(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "portfolios"
    __table_args__ = (
        CheckConstraint(f"theme IN ({sql_in(THEMES)})", name="theme_is_known"),
        CheckConstraint(f"ground IN ({sql_in(GROUNDS)})", name="ground_is_known"),
        CheckConstraint(f"font IN ({sql_in(FONTS)})", name="font_is_known"),
        CheckConstraint(f"status IN ({sql_in(STATUSES)})", name="status_is_known"),
        Index("ix_portfolios_user_id_created_at", "user_id", "created_at"),
        # The address is facet.page/<handle>/<slug>, so a slug only has to be
        # unique within the account that owns it. Two people can both publish
        # a page called "freelancer".
        UniqueConstraint("user_id", "slug", name="uq_portfolios_user_id_slug"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # One segment, scoped to the owner: the handle in front of it is what
    # makes the address unique. No slashes — nesting lived here only because
    # there was nothing else in the path to namespace it.
    slug: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="empty")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")

    theme: Mapped[str] = mapped_column(String(24), nullable=False, default="editorial")
    accent: Mapped[str] = mapped_column(String(32), nullable=False, default=DEFAULT_ACCENT)
    ground: Mapped[str] = mapped_column(String(16), nullable=False, default="light")
    font: Mapped[str] = mapped_column(String(24), nullable=False, default="archivo")
    layout: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=default_layout
    )

    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="portfolios")
    header: Mapped[PortfolioHeader] = relationship(
        back_populates="portfolio", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )
    sections: Mapped[list[Section]] = relationship(
        back_populates="portfolio",
        cascade="all, delete-orphan",
        order_by="Section.position",
        lazy="selectin",
    )


class PortfolioHeader(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """The header is a section with two extra lines: who you are, and now."""

    __tablename__ = "portfolio_headers"

    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"),
        unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    current: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    links: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    portrait_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True
    )

    portfolio: Mapped[Portfolio] = relationship(back_populates="header")
    portrait: Mapped[Asset | None] = relationship(lazy="selectin")


class Section(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Every section is the same four fields. Everything else is opt-in."""

    __tablename__ = "sections"
    __table_args__ = (
        CheckConstraint(f"kind IN ({sql_in(BLOCK_KINDS)})", name="kind_is_known"),
        CheckConstraint("position >= 0", name="position_is_not_negative"),
        Index("ix_sections_portfolio_id_position", "portfolio_id", "position"),
    )

    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    title: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    links: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    numbers: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    dates: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    quote: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Hidden sections stay in the document and drop off the published page.
    hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    kind: Mapped[str] = mapped_column(String(24), nullable=False, default="link")

    image_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True
    )
    file_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True
    )

    portfolio: Mapped[Portfolio] = relationship(back_populates="sections")
    image: Mapped[Asset | None] = relationship(foreign_keys=[image_asset_id], lazy="selectin")
    file: Mapped[Asset | None] = relationship(foreign_keys=[file_asset_id], lazy="selectin")
