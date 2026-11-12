"""A portfolio, its header, and its sections.

One page per portfolio: a header, then N sections that all share the same four
fields, and each files under exactly one tab. Numbers and the timeline hang
off the *header*: the published page has
one "By the numbers" row and one timeline, so a per-section copy would only be
gathered back up again. The ordered value lists (tags, links, numbers, dates,
quote, layout) are JSONB — they are always read with their parent and never queried across
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
    DEFAULT_ACCENT,
    DEFAULT_BODY_FONT,
    DEFAULT_FONT,
    DEFAULT_GROUND,
    DEFAULT_TAB,
    DEFAULT_THEME,
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
        "photo": "colour",
        "motion": "full",
        "sectionStyle": "theme",
    }


class Portfolio(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "portfolios"
    __table_args__ = (
        CheckConstraint(f"theme IN ({sql_in(THEMES)})", name="theme_is_known"),
        CheckConstraint(f"ground IN ({sql_in(GROUNDS)})", name="ground_is_known"),
        CheckConstraint(f"font IN ({sql_in(FONTS)})", name="font_is_known"),
        CheckConstraint(f"body_font IN ({sql_in(FONTS)})", name="body_font_is_known"),
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

    theme: Mapped[str] = mapped_column(String(24), nullable=False, default=DEFAULT_THEME)
    accent: Mapped[str] = mapped_column(String(32), nullable=False, default=DEFAULT_ACCENT)
    ground: Mapped[str] = mapped_column(
        String(16), nullable=False, default=DEFAULT_GROUND, server_default=DEFAULT_GROUND
    )
    # A custom ground colour, which wins over the preset named in `ground`.
    # Empty means "use the preset" — an empty string rather than NULL so a
    # PATCH can clear it, since a null there already means "not sent".
    ground_hex: Mapped[str] = mapped_column(
        String(7), nullable=False, default="", server_default=""
    )
    font: Mapped[str] = mapped_column(
        String(24), nullable=False, default=DEFAULT_FONT, server_default=DEFAULT_FONT
    )
    # The body face. Separate from `font`, which is the headline: the panel is
    # called "Type pairing" and a pairing needs both halves. The pair defaults
    # to the catalogue's house faces, so a portfolio nobody styled still comes
    # out set rather than falling back to one family doing both jobs.
    body_font: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        default=DEFAULT_BODY_FONT,
        server_default=DEFAULT_BODY_FONT,
    )
    layout: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=default_layout
    )
    # The resume this portfolio downloads as - its facts and its template.
    # Never part of the published page: it carries an email and a phone
    # number. ``{}`` validates to the defaults; see app/schemas/resume.py.
    resume: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    # The page's closing band: a call to action, a line of text, its own
    # links and a small print line. ``{}`` validates to the defaults, so a
    # portfolio that never opened the footer card still gets one built from
    # the header. See app/schemas/portfolio.py.
    footer: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
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
    """The header is a section with two extra lines: who you are, and now.

    It also carries the page's numbers and its timeline, which belong to the
    portfolio rather than to any one section.
    """

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
    numbers: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    dates: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    portrait_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True
    )

    portfolio: Mapped[Portfolio] = relationship(back_populates="header")
    portrait: Mapped[Asset | None] = relationship(lazy="selectin")


class Section(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Every section is the same four fields. Everything else is opt-in."""

    __tablename__ = "sections"
    __table_args__ = (
        CheckConstraint("position >= 0", name="position_is_not_negative"),
        CheckConstraint("length(btrim(tab)) > 0", name="tab_is_not_blank"),
        Index("ix_sections_portfolio_id_position", "portfolio_id", "position"),
    )

    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    title: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    #: The tab this section files under. Exactly one, never empty: it is the
    #: only way a visitor reaches the section, so a blank one would hide it.
    tab: Mapped[str] = mapped_column(String(60), nullable=False, default=DEFAULT_TAB)
    links: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    quote: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    #: Components under the four fields — a timeline, testimonials, a client
    #: wall. Validated as a discriminated union in app/schemas/blocks.py; JSONB
    #: because they are always read with their section and never queried.
    #: None of them references an upload, so asset release never looks here.
    blocks: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )

    # Hidden sections stay in the document and drop off the published page.
    hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Whether the section prints on the resume, under its tab as the heading.
    # Separate from `hidden`: a section can be on one look and not the other.
    on_resume: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    file_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True
    )

    portfolio: Mapped[Portfolio] = relationship(back_populates="sections")
    file: Mapped[Asset | None] = relationship(foreign_keys=[file_asset_id], lazy="selectin")
    #: The section's pictures, in order. A table rather than a JSONB list of
    #: ids: every upload reference is a foreign key, so asset release and the
    #: public asset route keep asking one kind of question.
    images: Mapped[list[SectionImage]] = relationship(
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="SectionImage.position",
        lazy="selectin",
    )


class SectionImage(UUIDPrimaryKeyMixin, Base):
    """One picture on a section, at a position."""

    __tablename__ = "section_images"
    __table_args__ = (
        CheckConstraint("position >= 0", name="position_is_not_negative"),
        UniqueConstraint("section_id", "position", name="uq_section_images_section_id_position"),
    )

    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    section: Mapped[Section] = relationship(back_populates="images")
    asset: Mapped[Asset] = relationship(lazy="selectin")
