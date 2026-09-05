"""Portfolio payloads."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field

from app.models.enums import (
    DEFAULT_ACCENT,
    DEFAULT_TRACKING,
    Density,
    FontId,
    Ground,
    PortfolioStatus,
    RoleNav,
    ThemeId,
    TypeScale,
)
from app.schemas.account import LinkItem
from app.schemas.asset import AssetOut
from app.schemas.common import CamelModel, StrictCamelModel
from app.schemas.section import SectionOut

#: Lowercase, digits and hyphens, in one or more "/"-separated segments; each
#: segment starts and ends alphanumeric. The address is facet.page/<slug>, so
#: it has to survive being typed and read aloud — and it is nested, because
#: the published route is a catch-all and the seeded pages use
#: One segment. The handle in front of it is what makes the address unique,
#: so a slug has no reason to nest — "rohan/investors" only existed because a
#: flat global namespace had nothing else to separate accounts with.
_SEGMENT = r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
SLUG_PATTERN = rf"^{_SEGMENT}$"
SlugField = Annotated[str, Field(pattern=SLUG_PATTERN, min_length=2, max_length=120)]

#: Any CSS colour the swatch row can produce.
ACCENT_PATTERN = r"^#[0-9a-fA-F]{6}$"


class Layout(StrictCamelModel):
    role_nav: RoleNav = "tabs"
    grid: Literal[1, 2, 3] = 2
    density: Density = "standard"
    scale: TypeScale = "default"
    tracking: str = Field(default=DEFAULT_TRACKING, max_length=32)


class HeaderOut(CamelModel):
    name: str
    current: str
    description: str
    tags: list[str]
    links: list[LinkItem]
    portrait: AssetOut | None


class HeaderPatch(StrictCamelModel):
    name: str | None = Field(default=None, max_length=200)
    current: str | None = Field(default=None, max_length=2000)
    description: str | None = Field(default=None, max_length=20_000)
    tags: list[str] | None = Field(default=None, max_length=40)
    links: list[LinkItem] | None = Field(default=None, max_length=60)
    portrait_asset_id: uuid.UUID | None = None
    clear_portrait: bool = False


class PortfolioOut(CamelModel):
    id: uuid.UUID
    name: str
    slug: str
    status: PortfolioStatus
    summary: str
    #: Derived on read ("3 sections · 2 days ago"), never stored, so it cannot
    #: go stale the way a written copy would.
    meta: str
    theme: ThemeId
    accent: str
    ground: Ground
    font: FontId
    layout: Layout
    header: HeaderOut
    sections: list[SectionOut]
    published_at: datetime | None
    updated_at: datetime


class PortfolioSummaryOut(CamelModel):
    """The list view: no sections, so /portfolios stays one query."""

    id: uuid.UUID
    name: str
    slug: str
    status: PortfolioStatus
    summary: str
    meta: str
    theme: ThemeId
    accent: str
    ground: Ground
    font: FontId
    section_count: int
    published_at: datetime | None
    updated_at: datetime


class StartFromBlank(StrictCamelModel):
    kind: Literal["blank"] = "blank"


class StartFromFounder(StrictCamelModel):
    kind: Literal["founder"] = "founder"


class StartFromCopy(StrictCamelModel):
    kind: Literal["copy"] = "copy"
    id: uuid.UUID


StartFrom = Annotated[
    StartFromBlank | StartFromFounder | StartFromCopy, Field(discriminator="kind")
]


class PortfolioCreate(StrictCamelModel):
    name: str = Field(min_length=1, max_length=200)
    slug: SlugField
    #: The line under the name on the portfolio card. Optional, and never
    #: part of the published page.
    summary: str = Field(default="", max_length=2000)
    start_from: StartFrom = StartFromBlank()


class PortfolioPatch(StrictCamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    slug: SlugField | None = None
    summary: str | None = Field(default=None, max_length=2000)
    theme: ThemeId | None = None
    accent: str | None = Field(default=None, pattern=ACCENT_PATTERN)
    ground: Ground | None = None
    font: FontId | None = None
    layout: Layout | None = None


class SlugAvailableOut(CamelModel):
    slug: str
    available: bool


DEFAULT_ACCENT_VALUE = DEFAULT_ACCENT
