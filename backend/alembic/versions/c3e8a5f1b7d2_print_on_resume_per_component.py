"""print on your resume, per component

The resume now follows the page: every section switched on for the resume
prints its title, and under it each component with "Print on your resume"
checked. A list used to print whatever its section's Resume switch said —
that switch only decided whether the section's own words printed — so a
section that places a list but has the switch off would lose the list.

Such a section is switched on here, and each component in it told
explicitly: its list prints unless the whole list was switched off for the
resume (``resume.hidden``), and nothing else under it does. The resume
prints what it printed before. Every other section is left alone; a
component stored without the flag gets its default when read
(``fix_resume_switches()`` in app/schemas/blocks.py does the same on
import).

The downgrade does nothing: it cannot tell a section this switched on from
one its owner switched on later, and the flags it wrote are ignored by the
build before this.

Revision ID: c3e8a5f1b7d2
Revises: a1d4f7c9e2b6
Create Date: 2026-11-15 14:00:00.000000
"""

from __future__ import annotations

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3e8a5f1b7d2"
down_revision: str | None = "a1d4f7c9e2b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LISTS = ("experience", "education", "skills", "certifications", "languages", "awards")


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT s.id, s.blocks, p.resume FROM sections s "
            "JOIN portfolios p ON p.id = s.portfolio_id WHERE NOT s.on_resume"
        )
    ).fetchall()
    for section_id, blocks, resume in rows:
        blocks = blocks if isinstance(blocks, list) else []
        if not any(isinstance(b, dict) and b.get("type") in LISTS for b in blocks):
            continue
        hidden = (resume if isinstance(resume, dict) else {}).get("hidden") or []
        fixed = [
            b
            if not isinstance(b, dict) or isinstance(b.get("onResume"), bool)
            else {**b, "onResume": b.get("type") in LISTS and b.get("type") not in hidden}
            for b in blocks
        ]
        bind.execute(
            sa.text(
                "UPDATE sections SET on_resume = true, blocks = CAST(:blocks AS jsonb) "
                "WHERE id = :id"
            ),
            {"id": section_id, "blocks": json.dumps(fixed)},
        )


def downgrade() -> None:
    """Nothing to undo; see the module docstring."""
