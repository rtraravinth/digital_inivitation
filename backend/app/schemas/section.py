"""Section payloads.

Every section is the same four fields — title, description, tags, links — so
there is nothing to learn twice. The rest is opt-in and may be absent.
"""

from __future__ import annotations

import uuid

from pydantic import Field

from app.models.enums import BlockKind
from app.schemas.account import LinkItem
from app.schemas.asset import AssetOut
from app.schemas.common import CamelModel, StrictCamelModel


class Stat(StrictCamelModel):
    id: str = Field(max_length=64)
    label: str = Field(default="", max_length=200)
    value: str = Field(default="", max_length=200)


class DateEntry(StrictCamelModel):
    id: str = Field(max_length=64)
    year: str = Field(default="", max_length=32)
    text: str = Field(default="", max_length=500)


class Quote(StrictCamelModel):
    text: str = Field(default="", max_length=2000)
    attribution: str = Field(default="", max_length=200)


class SectionOut(CamelModel):
    id: uuid.UUID
    title: str
    description: str
    tags: list[str]
    links: list[LinkItem]
    numbers: list[Stat]
    dates: list[DateEntry]
    quote: Quote | None
    hidden: bool
    kind: BlockKind
    image: AssetOut | None
    file: AssetOut | None


class SectionCreate(StrictCamelModel):
    """``kind`` only picks the glyph and a starting title."""

    kind: BlockKind = "link"


class SectionPatch(StrictCamelModel):
    title: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=20_000)
    tags: list[str] | None = Field(default=None, max_length=40)
    links: list[LinkItem] | None = Field(default=None, max_length=60)
    numbers: list[Stat] | None = Field(default=None, max_length=40)
    dates: list[DateEntry] | None = Field(default=None, max_length=60)
    # Explicitly nullable: null clears the quote, absent leaves it alone.
    quote: Quote | None = None
    hidden: bool | None = None
    kind: BlockKind | None = None
    image_asset_id: uuid.UUID | None = None
    file_asset_id: uuid.UUID | None = None
    clear_image: bool = False
    clear_file: bool = False


class SectionMove(StrictCamelModel):
    delta: int = Field(ge=-1, le=1)


class SectionOrder(StrictCamelModel):
    ids: list[uuid.UUID] = Field(min_length=1)
