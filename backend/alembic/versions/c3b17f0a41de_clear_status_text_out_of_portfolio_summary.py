"""clear status text out of portfolio summary

``summary`` is the author's own line about a page. Publishing used to
overwrite it with "Live." and unpublishing with "Not published.", and a new
portfolio started at "Not published yet.", so the card showed the status
twice: once in its tag and once in the sentence underneath.

The service no longer writes those strings. This clears the ones already
stored — they carry nothing the status column does not — and leaves every
other summary alone.

Revision ID: c3b17f0a41de
Revises: be640fab544d
Create Date: 2026-09-05 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3b17f0a41de"
down_revision: str | None = "be640fab544d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LEGACY = ("Live.", "Not published.", "Not published yet.")


def upgrade() -> None:
    op.execute(
        sa.text("UPDATE portfolios SET summary = '' WHERE summary IN :legacy").bindparams(
            sa.bindparam("legacy", value=LEGACY, expanding=True)
        )
    )


def downgrade() -> None:
    # The old text was derived from `status`, so it can be put back exactly.
    op.execute(
        sa.text(
            "UPDATE portfolios SET summary = CASE WHEN status = 'live' THEN 'Live.' "
            "ELSE 'Not published.' END WHERE summary = ''"
        )
    )
