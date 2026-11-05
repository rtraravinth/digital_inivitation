"""one content list, two looks

Edit text used to keep the page's words and the resume's facts in two
views, and the resume carried its own headline and summary — the same
sentences as the header's current line and About, typed twice. Now there is
one list: the header is the resume's top, and every block and section says
whether it shows on the page, on the resume, or both.

- ``sections.on_resume``: a section prints on the resume under its tab.
- The resume's ``headline`` and ``summary`` move into the header where the
  header has none, and leave the resume either way.
- ``pageBlocks`` (structured blocks on the page) defaults to all of them,
  except on a page that is live right now: publishing froze it, and a
  migration must not change what visitors see. Those start with none.

Revision ID: d2f7b8c41a90
Revises: c8e1a5f3d270
Create Date: 2026-11-01 18:00:00.000000
"""

from __future__ import annotations

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d2f7b8c41a90"
down_revision: str | None = "c8e1a5f3d270"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sections",
        sa.Column("on_resume", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT p.id, p.status, p.resume, h.id AS header_id, h.current, h.description "
            "FROM portfolios p LEFT JOIN portfolio_headers h ON h.portfolio_id = p.id"
        )
    ).mappings()
    for row in list(rows):
        resume = dict(row["resume"] or {})
        headline = str(resume.pop("headline", "") or "").strip()
        summary = str(resume.pop("summary", "") or "").strip()
        if row["status"] == "live" and "pageBlocks" not in resume:
            resume["pageBlocks"] = []

        if row["header_id"] is not None:
            current = row["current"] or ""
            description = row["description"] or ""
            if headline and not current.strip():
                current = headline
            if summary and not description.strip():
                description = summary
            bind.execute(
                sa.text("UPDATE portfolio_headers SET current = :c, description = :d WHERE id = :id"),
                {"c": current, "d": description, "id": row["header_id"]},
            )
        bind.execute(
            sa.text("UPDATE portfolios SET resume = CAST(:r AS jsonb) WHERE id = :id"),
            {"r": json.dumps(resume), "id": row["id"]},
        )


def downgrade() -> None:
    # The headline and summary stay in the header, which is where they are
    # read from either way; only the per-section switch is dropped.
    op.drop_column("sections", "on_resume")
