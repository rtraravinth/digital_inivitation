"""move every credential to Firebase Authentication

Firebase now proves who someone is — password, Google, GitHub, email link or
phone — and FACET only opens its own session once it has. So this database
stops holding credentials:

* ``users.password_hash`` is dropped, and with it every password.
* ``recovery_codes`` and the TOTP columns on ``account_settings`` go: two-step
  is Firebase's to offer now.
* ``users.firebase_uid`` is added, unique. Existing accounts start without
  one; the first Firebase sign-in whose email Firebase has *verified* and
  that matches ``users.email`` fills it in, so nobody loses their portfolios.
* ``users.email`` becomes nullable: an account made with a phone number has
  no address.
* ``account_settings.sign_in_provider`` records how the account last signed
  in, for /account.

``auth_sessions`` stays: FACET's own refresh cookie and device list are
unchanged.

**Not reversible in content.** The downgrade restores the columns and the
table, but the password hashes and TOTP secrets are gone; every account would
need its password reset by hand.

Revision ID: c4f1e8a2d6b9
Revises: a7d3e1c95f42
Create Date: 2026-11-13 13:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c4f1e8a2d6b9"
down_revision: str | None = "a7d3e1c95f42"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("firebase_uid", sa.String(length=128), nullable=True))
    op.create_unique_constraint("uq_users_firebase_uid", "users", ["firebase_uid"])
    op.alter_column("users", "email", existing_type=sa.String(length=320), nullable=True)
    op.drop_column("users", "password_hash")

    op.add_column(
        "account_settings",
        sa.Column("sign_in_provider", sa.String(length=32), nullable=False, server_default=""),
    )
    op.drop_column("account_settings", "two_step_secret")
    op.drop_column("account_settings", "two_step_enabled")
    op.drop_column("account_settings", "two_step_pending_secret")
    op.drop_column("account_settings", "password_changed_at")

    op.drop_index("ix_recovery_codes_user_id", table_name="recovery_codes")
    op.drop_table("recovery_codes")


def downgrade() -> None:
    op.create_table(
        "recovery_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_recovery_codes_user_id", "recovery_codes", ["user_id"])

    op.add_column(
        "account_settings",
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "account_settings",
        sa.Column("two_step_pending_secret", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "account_settings",
        sa.Column("two_step_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "account_settings",
        sa.Column("two_step_secret", sa.String(length=64), nullable=True),
    )
    op.drop_column("account_settings", "sign_in_provider")

    # The hashes are gone. An empty string verifies against nothing, so every
    # account is locked until its password is set again.
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(length=255), nullable=False, server_default=""),
    )
    op.alter_column("users", "password_hash", server_default=None)
    # Accounts made by phone have no email; they cannot survive the downgrade.
    op.execute("DELETE FROM users WHERE email IS NULL")
    op.alter_column("users", "email", existing_type=sa.String(length=320), nullable=False)
    op.drop_constraint("uq_users_firebase_uid", "users", type_="unique")
    op.drop_column("users", "firebase_uid")
