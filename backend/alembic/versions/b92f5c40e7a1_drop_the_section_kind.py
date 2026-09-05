"""drop the section kind

A section carried a ``kind`` — link, venture, contact, booking, testimonial,
gallery, numbers, document — chosen from the block manager's picker. It never
changed what a section *was*: every kind is the same fields underneath. All it
picked was a glyph on the Links theme and a starting title.

The block manager is gone, and it was the only screen that ever set a kind.
Everything else added a section as "link", so the column had stopped carrying
a decision anyone made.

The downgrade puts the column back with every row at "link", which is what the
rows would have said anyway. The kinds chosen before this runs are not kept.

Revision ID: b92f5c40e7a1
Revises: a7d3e6c1b048
Create Date: 2026-09-05 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b92f5c40e7a1"
down_revision: str | None = "a7d3e6c1b048"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

KINDS = (
    "link", "venture", "contact", "booking", "testimonial", "gallery",
    "numbers", "document",
)


def upgrade() -> None:
    op.drop_constraint("kind_is_known", "sections", type_="check")
    op.drop_column("sections", "kind")


def downgrade() -> None:
    op.add_column(
        "sections",
        sa.Column("kind", sa.String(length=24), nullable=False, server_default="link"),
    )
    op.alter_column("sections", "kind", server_default=None)
    allowed = ", ".join(f"'{kind}'" for kind in KINDS)
    op.create_check_constraint("kind_is_known", "sections", f"kind IN ({allowed})")
