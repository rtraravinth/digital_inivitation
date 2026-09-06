"""Accept the two new themes before the UI offers them.

Widening only. The four themes this set replaces are still accepted here;
the revision that removes them also remaps the rows that use them.

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
    op.drop_constraint("theme_is_known", "portfolios", type_="check")
    op.create_check_constraint("theme_is_known", "portfolios", f"theme IN ({OLD})")
