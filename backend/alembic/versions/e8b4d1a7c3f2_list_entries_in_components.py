"""each list component holds its own entries

A resume list component (experience, education, skills, certifications,
languages, awards) used to hold nothing: every component of a kind drew the
resume's one list of that kind, so a second Experience component showed —
and edited — the first one's roles. Each component now carries its own
``items``.

Every list component here is given a copy of the list it used to draw, so
nothing changes on any page or resume; a portfolio that placed one list
twice ends up with two identical copies, each now editable on its own. The
shared lists in ``portfolios.resume`` are then emptied, so no stale copy is
left to drift or leak.

The downgrade puts the entries back on the resume — for each kind, every
component's entries in page order, once per id — and takes ``items`` off
the components.

Revision ID: e8b4d1a7c3f2
Revises: d7a2c9e4f150
Create Date: 2026-11-15 18:00:00.000000
"""

from __future__ import annotations

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e8b4d1a7c3f2"
down_revision: str | None = "d7a2c9e4f150"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LISTS = ("experience", "education", "skills", "certifications", "languages", "awards")


def _sections(bind, portfolio_id):
    return bind.execute(
        sa.text("SELECT id, blocks FROM sections WHERE portfolio_id = :p ORDER BY position"),
        {"p": portfolio_id},
    ).fetchall()


def _save_blocks(bind, section_id, blocks) -> None:
    bind.execute(
        sa.text("UPDATE sections SET blocks = CAST(:b AS jsonb) WHERE id = :id"),
        {"id": section_id, "b": json.dumps(blocks)},
    )


def _save_resume(bind, portfolio_id, resume) -> None:
    bind.execute(
        sa.text("UPDATE portfolios SET resume = CAST(:r AS jsonb) WHERE id = :p"),
        {"p": portfolio_id, "r": json.dumps(resume)},
    )


def upgrade() -> None:
    bind = op.get_bind()
    for portfolio_id, resume in bind.execute(
        sa.text("SELECT id, resume FROM portfolios")
    ).fetchall():
        resume = resume if isinstance(resume, dict) else {}
        for section_id, blocks in _sections(bind, portfolio_id):
            if not isinstance(blocks, list):
                continue
            changed = False
            filled = []
            for b in blocks:
                if isinstance(b, dict) and b.get("type") in LISTS and "items" not in b:
                    entries = resume.get(b["type"])
                    b = {**b, "items": entries if isinstance(entries, list) else []}
                    changed = True
                filled.append(b)
            if changed:
                _save_blocks(bind, section_id, filled)
        if any(resume.get(kind) for kind in LISTS):
            _save_resume(bind, portfolio_id, {**resume, **{kind: [] for kind in LISTS}})


def downgrade() -> None:
    bind = op.get_bind()
    for portfolio_id, resume in bind.execute(
        sa.text("SELECT id, resume FROM portfolios")
    ).fetchall():
        resume = dict(resume) if isinstance(resume, dict) else {}
        gathered: dict[str, list] = {kind: [] for kind in LISTS}
        seen: dict[str, set] = {kind: set() for kind in LISTS}
        for section_id, blocks in _sections(bind, portfolio_id):
            if not isinstance(blocks, list):
                continue
            stripped = []
            changed = False
            for b in blocks:
                if isinstance(b, dict) and b.get("type") in LISTS and "items" in b:
                    for item in b.get("items") or []:
                        key = item.get("id") if isinstance(item, dict) else None
                        if key not in seen[b["type"]]:
                            seen[b["type"]].add(key)
                            gathered[b["type"]].append(item)
                    b = {k: v for k, v in b.items() if k != "items"}
                    changed = True
                stripped.append(b)
            if changed:
                _save_blocks(bind, section_id, stripped)
        if any(gathered.values()):
            _save_resume(bind, portfolio_id, {**resume, **gathered})
