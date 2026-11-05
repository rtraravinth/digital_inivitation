"""Remap the four replaced themes and narrow the constraint to five.

``index``, ``ledger``, ``dossier`` and ``broadsheet`` are gone from the
product; ``resume``, ``editorial``, ``poster``, ``links`` and ``site`` are
what remains. Every row on a removed theme is remapped before the
constraint narrows, so no row is ever left violating it.

The downgrade restores the old, nine-value constraint but cannot un-remap a
row: the mapping is many-to-one (``index``, ``dossier`` and ``broadsheet``
all become ``editorial``; ``ledger`` becomes ``resume``) and the row's
original value is not stored anywhere else. A portfolio that was
``broadsheet`` comes back as ``editorial``, permanently. That is a real
loss, not an oversight.

Revision ID: 75de75f4ca38
Revises: 2e81f921635c
Create Date: 2026-09-07 00:05:46.408967
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "75de75f4ca38"
down_revision: str | None = "2e81f921635c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Spelled out rather than imported, so this migration keeps describing the
#: schema it actually produced once the tuple moves on.
WIDE = (
    "'editorial', 'index', 'poster', 'links', 'ledger', 'dossier', "
    "'broadsheet', 'resume', 'site'"
)
FIVE = "'resume', 'editorial', 'poster', 'links', 'site'"


def upgrade() -> None:
    op.execute("UPDATE portfolios SET theme = 'resume' WHERE theme = 'ledger'")
    op.execute(
        "UPDATE portfolios SET theme = 'editorial' "
        "WHERE theme IN ('index', 'dossier', 'broadsheet')"
    )
    op.drop_constraint("theme_is_known", "portfolios", type_="check")
    op.create_check_constraint("theme_is_known", "portfolios", f"theme IN ({FIVE})")


def downgrade() -> None:
    op.drop_constraint("theme_is_known", "portfolios", type_="check")
    op.create_check_constraint("theme_is_known", "portfolios", f"theme IN ({WIDE})")
