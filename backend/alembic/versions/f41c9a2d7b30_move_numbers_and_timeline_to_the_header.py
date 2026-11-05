"""move numbers and the timeline to the header

Both were stored per section and then flattened back into one row and one
timeline for the whole page, so a section was never the thing that owned
them — it was only where they happened to be typed.

The upgrade concatenates each portfolio's sections in ``position`` order onto
its header, which is the order the page already drew them in, then drops the
section columns.

The downgrade puts empty columns back. It cannot put the entries back where
they were typed: which section a number came from is exactly what this
migration stops recording.

Revision ID: f41c9a2d7b30
Revises: c3b17f0a41de
Create Date: 2026-09-05 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f41c9a2d7b30"
down_revision: str | None = "c3b17f0a41de"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Every section's entries, oldest position first, as one array per portfolio.
#: ``jsonb_agg`` over an ordered subquery keeps the page's own order.
MERGE = """
UPDATE portfolio_headers AS h
SET {field} = COALESCE(gathered.entries, '[]'::jsonb)
FROM (
    SELECT s.portfolio_id, jsonb_agg(entry ORDER BY s.position, entry_index) AS entries
    FROM sections AS s
    CROSS JOIN LATERAL jsonb_array_elements(s.{field})
        WITH ORDINALITY AS t(entry, entry_index)
    GROUP BY s.portfolio_id
) AS gathered
WHERE h.portfolio_id = gathered.portfolio_id
"""


def upgrade() -> None:
    for field in ("numbers", "dates"):
        op.add_column(
            "portfolio_headers",
            sa.Column(
                field,
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )
        op.execute(MERGE.format(field=field))
        # The default was only there to fill the existing rows; the model
        # supplies one for new ones.
        op.alter_column("portfolio_headers", field, server_default=None)

    op.drop_column("sections", "numbers")
    op.drop_column("sections", "dates")


def downgrade() -> None:
    for field in ("numbers", "dates"):
        op.add_column(
            "sections",
            sa.Column(
                field,
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )
        op.alter_column("sections", field, server_default=None)

    op.drop_column("portfolio_headers", "numbers")
    op.drop_column("portfolio_headers", "dates")
