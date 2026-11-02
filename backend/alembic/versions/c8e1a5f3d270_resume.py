"""give every portfolio a resume

A portfolio now has two looks: the page it publishes and the resume it
downloads. The resume's facts — roles with dates, schools, skills — and its
template live in one JSONB column, read with the portfolio and never queried
across rows, like ``layout``.

``{}`` is a valid resume: it validates to the defaults, so every existing row
works untouched.

Revision ID: c8e1a5f3d270
Revises: b6e2f0d4a913
Create Date: 2026-11-01 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c8e1a5f3d270"
down_revision: str | None = "b6e2f0d4a913"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "portfolios",
        sa.Column(
            "resume",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("portfolios", "resume")
