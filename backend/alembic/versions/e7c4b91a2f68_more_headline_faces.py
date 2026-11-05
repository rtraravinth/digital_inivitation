"""widen the font check constraint for eleven more headline faces

The constraint mirrors the ``FONTS`` tuple, which mirrors the frontend's
``FontId``. That duplication is deliberate — it makes drift loud rather than
letting the API accept a face the UI cannot render — so adding faces means
rewriting the constraint rather than loosening it to a length check.

Every face added is variable and reaches at least 700, because
``globals.css`` sets ``font-weight: 800`` on every heading and a
single-weight family would be faux-bolded into a smear.

Revision ID: e7c4b91a2f68
Revises: d5a81c73f2e0
Create Date: 2026-09-06 11:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

from app.models.enums import sql_in

revision: str = "e7c4b91a2f68"
down_revision: str | None = "d5a81c73f2e0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Spelled out rather than imported from app.models.enums, so this migration
#: keeps describing the schema it actually produced when the tuple moves on.
BEFORE = ("archivo", "fraunces", "space-grotesk")
AFTER = (
    "archivo",
    "inter",
    "dm-sans",
    "space-grotesk",
    "manrope",
    "fraunces",
    "playfair-display",
    "source-serif-4",
    "lora",
    "roboto-slab",
    "bitter",
    "oswald",
    "syne",
    "jetbrains-mono",
)


def _swap(allowed: tuple[str, ...]) -> None:
    op.drop_constraint("font_is_known", "portfolios", type_="check")
    op.create_check_constraint("font_is_known", "portfolios", f"font IN ({sql_in(allowed)})")


def upgrade() -> None:
    _swap(AFTER)


def downgrade() -> None:
    # A portfolio on one of the new faces would fail the old constraint, so
    # put those back on the default before narrowing it.
    op.execute(f"UPDATE portfolios SET font = 'archivo' WHERE font NOT IN ({sql_in(BEFORE)})")
    _swap(BEFORE)
