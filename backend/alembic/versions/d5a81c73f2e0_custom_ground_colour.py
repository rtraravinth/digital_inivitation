"""let a portfolio carry a custom ground colour

``ground`` names one of three presets, and each preset supplies a whole
palette — paper, surface, ink, divider and two neutrals. A picked colour can
only supply the first of those, so the rest are derived from it on the
frontend rather than stored.

``ground_hex`` is therefore an override, not a replacement: empty means "use
the preset named in ``ground``", and the preset column keeps working
untouched for every existing row. Empty string rather than NULL, because a
null in a PATCH body already means "field not sent" and there would
otherwise be no way to clear a custom ground back to a preset.

Revision ID: d5a81c73f2e0
Revises: b92f5c40e7a1
Create Date: 2026-09-06 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d5a81c73f2e0"
down_revision: str | None = "b92f5c40e7a1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "portfolios",
        sa.Column(
            "ground_hex",
            sa.String(length=7),
            nullable=False,
            server_default="",
        ),
    )


def downgrade() -> None:
    # Every portfolio still names a preset, so dropping the override loses a
    # custom colour but never leaves a page without a ground.
    op.drop_column("portfolios", "ground_hex")
