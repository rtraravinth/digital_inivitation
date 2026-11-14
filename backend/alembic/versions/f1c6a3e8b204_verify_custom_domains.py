"""verify custom domains

``account_settings.custom_domain_verified_at`` records when the domain's TXT
record was found. Only a verified domain serves pages, and a partial unique
index lets one account at most hold a domain verified — typing a domain
claims nothing, so a squatter cannot block its owner.

Every stored domain starts unverified: none was ever checked.

Revision ID: f1c6a3e8b204
Revises: e5b9c2d7a481
Create Date: 2026-11-14 11:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f1c6a3e8b204"
down_revision: str | None = "e5b9c2d7a481"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "account_settings",
        sa.Column("custom_domain_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "uq_account_settings_verified_domain",
        "account_settings",
        ["custom_domain"],
        unique=True,
        postgresql_where=sa.text("custom_domain_verified_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_account_settings_verified_domain", table_name="account_settings")
    op.drop_column("account_settings", "custom_domain_verified_at")
