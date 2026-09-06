"""give a portfolio a body face of its own

``font`` was the headline face and the body was always Archivo, which made
the "Type pairing" panel a pairing with one half missing — picking Playfair
changed the headings and left every description in Archivo.

``body_font`` defaults to Archivo, so every existing portfolio renders
exactly as it did before this ran. It carries its own check constraint
against the same ``FONTS`` tuple, for the same reason ``font`` does: an
unknown face should fail loudly rather than reach a page that cannot draw it.

Revision ID: f8b3d20e5c91
Revises: e7c4b91a2f68
Create Date: 2026-09-06 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.models.enums import sql_in

revision: str = "f8b3d20e5c91"
down_revision: str | None = "e7c4b91a2f68"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Spelled out rather than imported, so this migration keeps describing the
#: schema it actually produced once the tuple moves on.
FACES = (
    "archivo", "inter", "dm-sans", "space-grotesk", "manrope", "fraunces",
    "playfair-display", "source-serif-4", "lora", "roboto-slab", "bitter",
    "oswald", "syne", "jetbrains-mono",
)


def upgrade() -> None:
    op.add_column(
        "portfolios",
        sa.Column("body_font", sa.String(length=24), nullable=False, server_default="archivo"),
    )
    op.create_check_constraint(
        "body_font_is_known", "portfolios", f"body_font IN ({sql_in(FACES)})"
    )


def downgrade() -> None:
    op.drop_constraint("body_font_is_known", "portfolios", type_="check")
    op.drop_column("portfolios", "body_font")
