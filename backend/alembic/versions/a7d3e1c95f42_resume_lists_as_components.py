"""resume lists as components

A resume list (experience, education, skills, certifications, languages,
awards) used to reach the published page through ``resume.pageBlocks``, and
the page drew each of its entries as a section of its own. Lists are now
components: one placed in a section puts the list on the page, there, in a
look its author picks.

So every list that was switched on for the page and has entries gets a
section holding its component — ahead of the page's own sections and in
resume order, which is where the page drew them — and ``pageBlocks`` is
dropped. A list with nothing in it gets no section: there was nothing on the
page to keep. The new sections are off the resume, because the resume prints
the list itself.

Revision ID: a7d3e1c95f42
Revises: f2c6a9d4e183
Create Date: 2026-11-12 10:00:00.000000
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a7d3e1c95f42"
down_revision: str | None = "f2c6a9d4e183"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Spelled out rather than imported, so this migration keeps describing the
#: data it moved once the application's own lists move on.
LISTS = ("experience", "education", "skills", "certifications", "languages", "awards")
DEFAULT_ORDER = ("experience", "education", "skills", "certifications", "languages", "awards")
LABEL = {
    "experience": "Experience",
    "education": "Education",
    "skills": "Skills",
    "certifications": "Certifications",
    "languages": "Languages",
    "awards": "Awards",
}
LOOK = {
    "experience": "timeline",
    "education": "list",
    "skills": "tags",
    "certifications": "list",
    "languages": "tags",
    "awards": "list",
}


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, resume FROM portfolios")).fetchall()
    for portfolio_id, resume in rows:
        resume = resume if isinstance(resume, dict) else {}
        # An absent key meant "all of them": that was the default.
        on_page = resume.get("pageBlocks", list(LISTS))
        order = [b for b in resume.get("order") or [] if b in LISTS]
        order += [b for b in DEFAULT_ORDER if b not in order]
        placed = [b for b in order if b in on_page and resume.get(b)]

        if placed:
            bind.execute(
                sa.text("UPDATE sections SET position = position + :n WHERE portfolio_id = :p"),
                {"n": len(placed), "p": portfolio_id},
            )
            for position, kind in enumerate(placed):
                block = {"id": f"list-{kind}", "type": kind, "title": "", "look": LOOK[kind]}
                bind.execute(
                    sa.text(
                        "INSERT INTO sections "
                        "(id, portfolio_id, position, title, description, tab, links, hidden, "
                        " on_resume, blocks) "
                        "VALUES (:id, :p, :position, :title, '', :tab, '[]'::jsonb, false, "
                        " false, CAST(:blocks AS jsonb))"
                    ),
                    {
                        "id": uuid.uuid4(),
                        "p": portfolio_id,
                        "position": position,
                        "title": LABEL[kind],
                        "tab": LABEL[kind],
                        "blocks": json.dumps([block]),
                    },
                )

    op.execute("UPDATE portfolios SET resume = resume - 'pageBlocks' WHERE resume ? 'pageBlocks'")


def downgrade() -> None:
    """Back to ``pageBlocks``: the lists that have a component, and the
    components gone. A section that held nothing else goes with them."""
    bind = op.get_bind()
    listed = ", ".join(f"'{kind}'" for kind in LISTS)
    rows = bind.execute(
        sa.text(
            "SELECT s.portfolio_id, array_agg(DISTINCT b->>'type') "
            "FROM sections s, jsonb_array_elements(s.blocks) b "
            f"WHERE b->>'type' IN ({listed}) AND NOT s.hidden "
            "GROUP BY s.portfolio_id"
        )
    ).fetchall()
    on_page = {row[0]: row[1] for row in rows}

    for (portfolio_id,) in bind.execute(sa.text("SELECT id FROM portfolios")).fetchall():
        bind.execute(
            sa.text(
                "UPDATE portfolios SET resume = "
                "jsonb_set(resume, '{pageBlocks}', CAST(:kinds AS jsonb)) WHERE id = :p"
            ),
            {"kinds": json.dumps(on_page.get(portfolio_id, [])), "p": portfolio_id},
        )

    op.execute(
        "UPDATE sections SET blocks = COALESCE("
        "(SELECT jsonb_agg(b) FROM jsonb_array_elements(blocks) b "
        f" WHERE b->>'type' NOT IN ({listed})), '[]'::jsonb) "
        "WHERE EXISTS "
        f"(SELECT 1 FROM jsonb_array_elements(blocks) b WHERE b->>'type' IN ({listed}))"
    )
    op.execute(
        "DELETE FROM sections s WHERE s.blocks = '[]'::jsonb AND s.description = '' "
        "AND s.links = '[]'::jsonb AND s.quote IS NULL AND s.file_asset_id IS NULL "
        f"AND s.title IN ({', '.join(repr(v) for v in LABEL.values())}) AND s.title = s.tab "
        "AND NOT EXISTS (SELECT 1 FROM section_images i WHERE i.section_id = s.id)"
    )
