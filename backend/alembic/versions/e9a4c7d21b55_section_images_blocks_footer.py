"""section pictures, components, and a footer

A section was title, description, links and one image. It is now title,
description, links and any number of pictures, plus components — a
timeline, testimonials, a client wall, tabs, numbers, services, questions,
a contact panel — and the page gains a footer of its own.

- ``section_images``: one row per picture, in order. Each section's single
  ``image_asset_id`` becomes its first row, then the column goes.
- ``sections.blocks``: the components, JSONB, empty for every section.
- ``portfolios.footer``: JSONB, ``{}`` — which validates to a footer built
  from the header, so no live page changes what it shows.

Revision ID: e9a4c7d21b55
Revises: d2f7b8c41a90
Create Date: 2026-11-06 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e9a4c7d21b55"
down_revision: str | None = "d2f7b8c41a90"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "section_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "position >= 0", name=op.f("ck_section_images_position_is_not_negative")
        ),
        sa.ForeignKeyConstraint(
            ["section_id"],
            ["sections.id"],
            name=op.f("fk_section_images_section_id_sections"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["asset_id"],
            ["assets.id"],
            name=op.f("fk_section_images_asset_id_assets"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_section_images")),
        sa.UniqueConstraint("section_id", "position", name="uq_section_images_section_id_position"),
    )
    op.create_index(op.f("ix_section_images_section_id"), "section_images", ["section_id"])
    op.create_index(op.f("ix_section_images_asset_id"), "section_images", ["asset_id"])

    op.execute(
        """
        INSERT INTO section_images (id, section_id, asset_id, position)
        SELECT gen_random_uuid(), id, image_asset_id, 0
        FROM sections
        WHERE image_asset_id IS NOT NULL
        """
    )
    op.drop_constraint("fk_sections_image_asset_id_assets", "sections", type_="foreignkey")
    op.drop_column("sections", "image_asset_id")

    op.add_column(
        "sections",
        sa.Column(
            "blocks",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )
    op.add_column(
        "portfolios",
        sa.Column(
            "footer",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
    )


def downgrade() -> None:
    """Back to one image per section. Only the first picture survives, and
    every component and footer is lost — there is nowhere to keep them."""
    op.drop_column("portfolios", "footer")
    op.drop_column("sections", "blocks")
    op.add_column(
        "sections",
        sa.Column("image_asset_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_sections_image_asset_id_assets",
        "sections",
        "assets",
        ["image_asset_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute(
        """
        UPDATE sections SET image_asset_id = si.asset_id
        FROM section_images si
        WHERE si.section_id = sections.id AND si.position = 0
        """
    )
    op.drop_index(op.f("ix_section_images_asset_id"), table_name="section_images")
    op.drop_index(op.f("ix_section_images_section_id"), table_name="section_images")
    op.drop_table("section_images")
