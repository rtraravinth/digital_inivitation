"""Replace the catalogue themes with the five motion themes; add two faces.

``resume``, ``editorial``, ``poster``, ``links`` and ``site`` are gone from
the product. ``aurora``, ``meridian``, ``stage``, ``arcade`` and ``journey``
replace them, and every row on a retired theme is remapped to the nearest
new one before the constraint narrows, so no row ever violates it:

- ``editorial`` and ``site`` — a tabbed grid and a full website — become
  ``aurora``, the new default and the closest in purpose.
- ``resume`` becomes ``meridian``, the calm credentials page.
- ``poster`` becomes ``stage``, the display-type page for people who perform.
- ``links`` becomes ``journey``, the stacked single-column story.

``arcade`` has no predecessor; nothing maps onto it.

Lexend and Outfit join the faces. Both are variable to 900, which is the
entry requirement: ``globals.css`` sets 700 on every heading and a
single-weight family would be faux-bolded into a smear.

The downgrade restores the old constraints but cannot fully un-remap a row:
two old themes became ``aurora`` and the row's original value is not stored
anywhere else, so ``site`` comes back as ``editorial``, and ``arcade`` —
which never existed before — also lands on ``editorial``. That is a real
loss, not an oversight, and the same trade the five-theme migration made.

Revision ID: b6e2f0d4a913
Revises: a1c4e9f27b60
Create Date: 2026-10-31 19:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

from app.models.enums import sql_in

revision: str = "b6e2f0d4a913"
down_revision: str | None = "a1c4e9f27b60"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Spelled out rather than imported, so this migration keeps describing the
#: schema it actually produced once the tuples move on.
OLD_THEMES = ("resume", "editorial", "poster", "links", "site")
NEW_THEMES = ("aurora", "meridian", "stage", "arcade", "journey")

FORWARD = {
    "editorial": "aurora",
    "site": "aurora",
    "resume": "meridian",
    "poster": "stage",
    "links": "journey",
}
BACKWARD = {
    "aurora": "editorial",
    "meridian": "resume",
    "stage": "poster",
    "journey": "links",
    "arcade": "editorial",
}

OLD_FACES = (
    "bodoni-moda",
    "schibsted-grotesk",
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
NEW_FACES = (*OLD_FACES, "lexend", "outfit")

FACE_CONSTRAINTS = (("font_is_known", "font"), ("body_font_is_known", "body_font"))


def _themes(allowed: tuple[str, ...], mapping: dict[str, str]) -> None:
    # The old constraint has to go first: the remapped values are outside it.
    op.drop_constraint("theme_is_known", "portfolios", type_="check")
    for before, after in mapping.items():
        op.execute(f"UPDATE portfolios SET theme = '{after}' WHERE theme = '{before}'")
    op.create_check_constraint("theme_is_known", "portfolios", f"theme IN ({sql_in(allowed)})")


def _faces(allowed: tuple[str, ...]) -> None:
    for name, column in FACE_CONSTRAINTS:
        op.drop_constraint(name, "portfolios", type_="check")
        op.create_check_constraint(name, "portfolios", f"{column} IN ({sql_in(allowed)})")


def upgrade() -> None:
    _themes(NEW_THEMES, FORWARD)
    _faces(NEW_FACES)


def downgrade() -> None:
    # A row on one of the new faces would fail the narrowed constraint, so it
    # goes back to the house pairing first.
    op.execute(
        f"UPDATE portfolios SET font = 'bodoni-moda' WHERE font NOT IN ({sql_in(OLD_FACES)})"
    )
    op.execute(
        "UPDATE portfolios SET body_font = 'schibsted-grotesk' "
        f"WHERE body_font NOT IN ({sql_in(OLD_FACES)})"
    )
    _faces(OLD_FACES)
    _themes(OLD_THEMES, BACKWARD)
