"""remember when a session's Firebase sign-in happened

A refresh rotates the session row every 15 minutes, so ``created_at`` says
when the latest token was issued, not when the person signed in. Firebase
revokes by that second moment — a password reset or an admin revocation
moves the user's ``validSince`` past it — so ``auth_sessions.signed_in_at``
carries it across rotations.

Rows that exist already get their ``created_at``: the closest thing on hand,
and never earlier than the real sign-in, so no live session is revoked by
the backfill itself.

Revision ID: d8a3b5e7f1c2
Revises: c4f1e8a2d6b9
Create Date: 2026-11-13 18:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d8a3b5e7f1c2"
down_revision: str | None = "c4f1e8a2d6b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "auth_sessions", sa.Column("signed_in_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.execute("UPDATE auth_sessions SET signed_in_at = created_at")
    op.alter_column("auth_sessions", "signed_in_at", nullable=False)


def downgrade() -> None:
    op.drop_column("auth_sessions", "signed_in_at")
