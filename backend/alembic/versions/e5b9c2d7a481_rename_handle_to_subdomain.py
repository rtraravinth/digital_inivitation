"""rename account_profiles.handle to subdomain

A published page lives at ``<subdomain>.facetfolio.com/<slug>`` now, so the
part of the address an account claims is a subdomain, and the column says
so. A rename keeps every value and the unique index; nothing is copied.

Revision ID: e5b9c2d7a481
Revises: d8a3b5e7f1c2
Create Date: 2026-11-14 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "e5b9c2d7a481"
down_revision: str | None = "d8a3b5e7f1c2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("account_profiles", "handle", new_column_name="subdomain")
    op.execute(
        "ALTER TABLE account_profiles RENAME CONSTRAINT uq_account_profiles_handle "
        "TO uq_account_profiles_subdomain"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE account_profiles RENAME CONSTRAINT uq_account_profiles_subdomain "
        "TO uq_account_profiles_handle"
    )
    op.alter_column("account_profiles", "subdomain", new_column_name="handle")
