"""the bio theme

A sixth theme: a link-in-bio page — the header, the links and the footer,
nothing else. It only widens the theme constraint; no stored row changes.

Revision ID: f2c6a9d4e183
Revises: e9a4c7d21b55
Create Date: 2026-11-06 14:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "f2c6a9d4e183"
down_revision: str | None = "e9a4c7d21b55"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Spelled out rather than imported, so this migration keeps describing the
#: schema it produced once THEMES moves on.
BEFORE = ("aurora", "meridian", "stage", "arcade", "journey")
AFTER = (*BEFORE, "bio")


def _allow(themes: tuple[str, ...]) -> None:
    op.drop_constraint("theme_is_known", "portfolios", type_="check")
    listed = ", ".join(f"'{t}'" for t in themes)
    op.create_check_constraint("theme_is_known", "portfolios", f"theme IN ({listed})")


def upgrade() -> None:
    _allow(AFTER)


def downgrade() -> None:
    # A bio page has to land somewhere the narrowed constraint accepts.
    op.execute("UPDATE portfolios SET theme = 'journey' WHERE theme = 'bio'")
    _allow(BEFORE)
