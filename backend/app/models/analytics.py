"""View and click events.

Events, not counters. A counter cannot answer "the last thirty days", cannot
be corrected, and throws the referrer away. These rows are the only source of
every figure on /stats — nothing here is ever generated or estimated.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin


class PageView(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "page_views"
    __table_args__ = (
        # The server-side equivalent of the frontend's per-load guard. A
        # refresh loop, a double-mounted effect and a retried request all
        # collapse to one row.
        UniqueConstraint("portfolio_id", "dedupe_key", name="uq_page_views_portfolio_id_dedupe"),
        Index("ix_page_views_portfolio_id_occurred_at", "portfolio_id", "occurred_at"),
    )

    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False
    )
    source: Mapped[str] = mapped_column(String(120), nullable=False, default="Direct")
    referrer_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dedupe_key: Mapped[str] = mapped_column(String(128), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )


class LinkClick(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "link_clicks"
    __table_args__ = (
        Index("ix_link_clicks_portfolio_id_occurred_at", "portfolio_id", "occurred_at"),
    )

    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False
    )
    # Not a foreign key: a click on a section that is later deleted is still a
    # click that happened, and the summary should not lose it.
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    target_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
