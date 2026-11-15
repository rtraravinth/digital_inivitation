"""drop a section's downloadable file

A section no longer offers a file to download, so ``sections.file_asset_id``
goes. The uploads it pointed at are left in ``assets``: nothing on a page
reaches them any more, and ``DELETE /assets/{id}`` still removes one. They
are not dropped here because their bytes live on disk under
``FACET_MEDIA_ROOT``, which a migration cannot reach.

The downgrade brings the column back empty; what it held is gone.

Revision ID: a1d4f7c9e2b6
Revises: f1c6a3e8b204
Create Date: 2026-11-15 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1d4f7c9e2b6"
down_revision: str | None = "f1c6a3e8b204"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("sections", "file_asset_id")


def downgrade() -> None:
    op.add_column(
        "sections",
        sa.Column("file_asset_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_sections_file_asset_id_assets",
        "sections",
        "assets",
        ["file_asset_id"],
        ["id"],
        ondelete="SET NULL",
    )
