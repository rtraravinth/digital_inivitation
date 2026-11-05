"""scope portfolio slugs to the owner

The address becomes ``facet.page/<handle>/<slug>``, so the handle in front is
what makes it unique and the slug only has to be unique within one account.
Two people can both publish a page called "freelancer".

Nested slugs go with it. "rohan/investors" existed because a flat global
namespace had nothing else to separate one person's pages from another's;
with the handle in the path that prefix is noise, so a slug collapses to its
last segment. Collisions inside one account get a numeric suffix rather than
losing a row.

Revision ID: be640fab544d
Revises: e576c2f5da41
Create Date: 2026-09-05 09:04:38.806530
"""

from __future__ import annotations

import re
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "be640fab544d"
down_revision: str | None = "e576c2f5da41"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UNSAFE = re.compile(r"[^a-z0-9-]+")


def _flatten(slug: str) -> str:
    """"rohan/investors" -> "investors"; anything odd -> a safe fallback."""
    last = slug.strip("/").split("/")[-1].strip().lower()
    cleaned = _UNSAFE.sub("-", last).strip("-")
    return cleaned[:120] or "page"


def upgrade() -> None:
    connection = op.get_bind()

    # Drop the global unique index first. Two accounts' slugs can legitimately
    # flatten to the same word ("a/investors" and "b/investors" both become
    # "investors"), and while the old index is still in place that rewrite
    # collides before the new per-owner constraint exists to allow it.
    op.drop_index("ix_portfolios_slug", table_name="portfolios")

    rows = connection.execute(
        sa.text("SELECT id, user_id, slug FROM portfolios ORDER BY user_id, created_at")
    ).fetchall()

    # Rewrite in one pass per account so a suffix is only spent on a real
    # collision, and the oldest page keeps the plain name.
    taken: dict[str, set[str]] = {}
    for row_id, user_id, slug in rows:
        owned = taken.setdefault(str(user_id), set())
        wanted = _flatten(slug)
        candidate, n = wanted, 2
        while candidate in owned:
            candidate = f"{wanted}-{n}"
            n += 1
        owned.add(candidate)
        if candidate != slug:
            connection.execute(
                sa.text("UPDATE portfolios SET slug = :slug WHERE id = :id"),
                {"slug": candidate, "id": row_id},
            )

    op.create_index("ix_portfolios_slug", "portfolios", ["slug"], unique=False)
    op.create_unique_constraint(
        "uq_portfolios_user_id_slug", "portfolios", ["user_id", "slug"]
    )


def downgrade() -> None:
    """Reversible only in shape, not in content.

    The old global index cannot be recreated if two accounts now hold the same
    slug, and the "rohan/" prefixes this dropped are not recoverable — they
    were never stored anywhere else. Suffix the duplicates so the unique index
    can be rebuilt; the addresses are different from the ones that were there
    before, and that is unavoidable.
    """
    connection = op.get_bind()

    rows = connection.execute(
        sa.text("SELECT id, slug FROM portfolios ORDER BY created_at")
    ).fetchall()

    seen: set[str] = set()
    for row_id, slug in rows:
        candidate, n = slug, 2
        while candidate in seen:
            candidate = f"{slug}-{n}"
            n += 1
        seen.add(candidate)
        if candidate != slug:
            connection.execute(
                sa.text("UPDATE portfolios SET slug = :slug WHERE id = :id"),
                {"slug": candidate, "id": row_id},
            )

    op.drop_constraint("uq_portfolios_user_id_slug", "portfolios", type_="unique")
    op.drop_index("ix_portfolios_slug", table_name="portfolios")
    op.create_index("ix_portfolios_slug", "portfolios", ["slug"], unique=True)
