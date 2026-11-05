"""one tab per section

A section used to carry a list of tags, and the published page turned those
tags into its navigation: every distinct tag became a tab, plus an "All work"
tab for everything at once. A section with no tags was reachable only through
that catch-all, and a section with three tags appeared under three tabs.

Navigation is now one required tab per section. The first tag becomes it —
that is the one the tab row showed first — and a section with no tags gets
``Work``. The remaining tags are dropped: nothing reads them any more.

The downgrade puts a ``tags`` list back holding the single tab, which is
lossless in the direction that matters. The tags beyond the first are gone
from the moment this runs.

Revision ID: a7d3e6c1b048
Revises: f41c9a2d7b30
Create Date: 2026-09-05 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a7d3e6c1b048"
down_revision: str | None = "f41c9a2d7b30"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_TAB = "Work"

FILL = """
UPDATE sections
SET tab = COALESCE(NULLIF(btrim(tags ->> 0), ''), :fallback)
"""

RESTORE = """
UPDATE sections
SET tags = jsonb_build_array(tab)
WHERE btrim(tab) <> ''
"""


def upgrade() -> None:
    op.add_column(
        "sections",
        sa.Column("tab", sa.String(length=60), nullable=False, server_default=DEFAULT_TAB),
    )
    op.execute(sa.text(FILL).bindparams(fallback=DEFAULT_TAB))
    # The default was only there to fill the rows that already existed; the
    # model decides what a new section files under.
    op.alter_column("sections", "tab", server_default=None)
    op.create_check_constraint("tab_is_not_blank", "sections", "length(btrim(tab)) > 0")

    op.drop_column("sections", "tags")


def downgrade() -> None:
    op.add_column(
        "sections",
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.execute(sa.text(RESTORE))
    op.alter_column("sections", "tags", server_default=None)

    op.drop_constraint("tab_is_not_blank", "sections", type_="check")
    op.drop_column("sections", "tab")
