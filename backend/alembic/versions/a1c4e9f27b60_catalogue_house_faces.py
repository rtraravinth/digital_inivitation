"""admit the catalogue's two house faces, and make them the defaults

The Catalogue visual world sets half-titles and plate numbers in Bodoni Moda
and captions, body and controls in Schibsted Grotesk. Both are offered to
authors as well, so both have to pass ``font_is_known`` and
``body_font_is_known``.

Those constraints mirror the ``FONTS`` tuple, which mirrors the frontend's
``FontId``. The duplication is deliberate — it makes drift loud rather than
letting the API accept a face the UI cannot render — so adding faces means
rewriting the constraints rather than loosening them to a length check.

Both faces are variable and reach 700, which is the entry requirement:
``globals.css`` sets ``font-weight: 700`` on every heading, and a
single-weight family would be faux-bolded into a smear.

The column defaults move too, from Archivo on both halves to the house
pairing, and ``ground`` from plate white to board. Defaults apply to rows
inserted after this runs; **no existing portfolio is repainted**. An author
who chose Archivo keeps Archivo, and a page that was on the light ground
stays on it — the redesign changes what the product ships next, not what
somebody already published.

Revision ID: a1c4e9f27b60
Revises: 75de75f4ca38
Create Date: 2026-10-10 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

from app.models.enums import sql_in

revision: str = "a1c4e9f27b60"
down_revision: str | None = "75de75f4ca38"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Spelled out rather than imported from app.models.enums, so this migration
#: keeps describing the schema it actually produced when the tuple moves on.
BEFORE = (
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
AFTER = ("bodoni-moda", "schibsted-grotesk", *BEFORE)

#: Both halves of the pairing carry a check, so both are rewritten.
CONSTRAINTS = (("font_is_known", "font"), ("body_font_is_known", "body_font"))


def _swap(allowed: tuple[str, ...]) -> None:
    for name, column in CONSTRAINTS:
        op.drop_constraint(name, "portfolios", type_="check")
        op.create_check_constraint(name, "portfolios", f"{column} IN ({sql_in(allowed)})")


def upgrade() -> None:
    _swap(AFTER)
    op.alter_column("portfolios", "font", server_default="bodoni-moda")
    op.alter_column("portfolios", "body_font", server_default="schibsted-grotesk")
    op.alter_column("portfolios", "ground", server_default="dark")


def downgrade() -> None:
    op.alter_column("portfolios", "ground", server_default="light")
    op.alter_column("portfolios", "body_font", server_default="archivo")
    op.alter_column("portfolios", "font", server_default="archivo")
    # A portfolio on one of the house faces would fail the narrowed
    # constraint, so put those back on Archivo before narrowing it.
    for _, column in CONSTRAINTS:
        op.execute(
            f"UPDATE portfolios SET {column} = 'archivo' WHERE {column} NOT IN ({sql_in(BEFORE)})"
        )
    _swap(BEFORE)
