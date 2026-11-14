"""Portfolio payloads."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field

from app.models.enums import (
    DEFAULT_TRACKING,
    TAG_MAX_LENGTH,
    Density,
    FontId,
    Ground,
    MotionLevel,
    PhotoTreatment,
    PortfolioStatus,
    RoleNav,
    SectionStyle,
    ThemeId,
    TypeScale,
)
from app.schemas.account import LinkItem
from app.schemas.asset import AssetOut
from app.schemas.common import CamelModel, SafeUrl, StrictCamelModel
from app.schemas.resume import Resume
from app.schemas.section import DateEntry, SectionOut, Stat

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

#: The same, plus the empty string, which means "fall back to the `ground`
#: preset". Empty rather than null because a null in a PATCH already means
#: "field not sent", so there would be no way left to clear a custom ground.
GROUND_HEX_PATTERN = r"^(#[0-9a-fA-F]{6})?$"

TagText = Annotated[str, Field(max_length=TAG_MAX_LENGTH)]


class Layout(StrictCamelModel):
    role_nav: RoleNav = "tabs"
    grid: Literal[1, 2, 3] = 2
    density: Density = "standard"
    scale: TypeScale = "default"
    tracking: str = Field(default=DEFAULT_TRACKING, max_length=32)
    photo: PhotoTreatment = "colour"
    motion: MotionLevel = "full"
    #: The shape the page's plain sections take, whatever the theme. A row
    #: stored before this existed has no key and reads as "theme".
    section_style: SectionStyle = "theme"


class Footer(StrictCamelModel):
    """The page's closing band.

    Every field is optional, and an empty footer still renders: the themes
    fall back to the header's name and links, so a portfolio that never
    opened the footer card ends the way it always did.
    """

    #: The call to action, e.g. "Let's build something together".
    headline: str = Field(default="", max_length=200)
    text: str = Field(default="", max_length=2000)
    #: The button under the headline — usually a mailto or a booking page.
    cta_label: str = Field(default="", max_length=60)
    cta_url: SafeUrl = ""
    #: Links of the footer's own, beside the header's contact links.
    links: list[LinkItem] = Field(default_factory=list, max_length=30)
    #: The small print, e.g. "© 2026 Priya Raman · Bengaluru".
    note: str = Field(default="", max_length=300)
    #: Whether the header's links repeat in the footer.
    show_header_links: bool = True


class HeaderOut(CamelModel):
    """The header, plus the two lists the whole page shares.

    ``numbers`` feeds the "By the numbers" row and ``dates`` the timeline.
    Both are drawn once per page, so they belong to the portfolio and not to
    whichever section happened to be typed into first.
    """

    name: str
    current: str
    description: str
    tags: list[str]
    links: list[LinkItem]
    numbers: list[Stat]
    dates: list[DateEntry]
    portrait: AssetOut | None


class HeaderPatch(StrictCamelModel):
    name: str | None = Field(default=None, max_length=200)
    current: str | None = Field(default=None, max_length=2000)
    description: str | None = Field(default=None, max_length=20_000)
    tags: list[TagText] | None = Field(default=None, max_length=40)
    links: list[LinkItem] | None = Field(default=None, max_length=60)
    numbers: list[Stat] | None = Field(default=None, max_length=40)
    dates: list[DateEntry] | None = Field(default=None, max_length=60)
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
    ground_hex: str
    font: FontId
    body_font: FontId
    layout: Layout
    #: The owner's own document. Deliberately absent from PublicPortfolioOut.
    resume: Resume
    header: HeaderOut
    footer: Footer
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
    ground_hex: str
    font: FontId
    body_font: FontId
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
    ground_hex: str | None = Field(default=None, pattern=GROUND_HEX_PATTERN)
    font: FontId | None = None
    body_font: FontId | None = None
    layout: Layout | None = None
    footer: Footer | None = None


class SlugAvailableOut(CamelModel):
    slug: str
    available: bool
