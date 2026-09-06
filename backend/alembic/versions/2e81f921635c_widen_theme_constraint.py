"""Accept the two new themes before the UI offers them.

Widening only. The four themes this set replaces are still accepted here;
the revision that removes them also remaps the rows that use them.

The downgrade narrows again, so it first puts every row on one of the two
new themes back on ``editorial`` — Postgres checks existing rows when a
CHECK is added, and the seeded set ships a ``resume`` portfolio.

Revision ID: 2e81f921635c
Revises: f8b3d20e5c91
Create Date: 2026-09-06 19:41:57.309932
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "2e81f921635c"
down_revision: str | None = "f8b3d20e5c91"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD = "'editorial', 'index', 'poster', 'links', 'ledger', 'dossier', 'broadsheet'"
NEW = OLD + ", 'resume', 'site'"


def upgrade() -> None:
    op.drop_constraint("theme_is_known", "portfolios", type_="check")
    op.create_check_constraint("theme_is_known", "portfolios", f"theme IN ({NEW})")


def downgrade() -> None:
    # Postgres validates every existing row when a CHECK is added, so a
    # portfolio on one of the two themes this revision introduced would make
    # the narrower constraint fail outright rather than merely disallow
    # future writes. The seeded set ships a `resume` portfolio, so this is
    # the ordinary case and not a corner one: put those rows back on the
    # default first, exactly as the headline-faces revision does.
    op.execute("UPDATE portfolios SET theme = 'editorial' WHERE theme IN ('resume', 'site')")
    op.drop_constraint("theme_is_known", "portfolios", type_="check")
    op.create_check_constraint("theme_is_known", "portfolios", f"theme IN ({OLD})")
