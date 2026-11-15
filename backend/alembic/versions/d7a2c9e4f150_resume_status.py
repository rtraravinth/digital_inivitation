"""publish the resume apart from the page

``portfolios.resume_status`` is ``live`` or ``draft``, beside the page's own
``status``. Every existing portfolio starts as a draft resume.

Revision ID: d7a2c9e4f150
Revises: c3e8a5f1b7d2
Create Date: 2026-11-15 14:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d7a2c9e4f150"
down_revision: str | None = "c3e8a5f1b7d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "portfolios",
        sa.Column(
            "resume_status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'draft'"),
        ),
    )
    op.create_check_constraint(
        "resume_status_is_known", "portfolios", "resume_status IN ('live', 'draft')"
    )


def downgrade() -> None:
    op.drop_constraint("resume_status_is_known", "portfolios", type_="check")
    op.drop_column("portfolios", "resume_status")
