"""What a visitor to a published page receives.

Deliberately not ``PortfolioOut``. The public payload is a different thing
with a different audience: it carries no ids a visitor cannot use, it drops
hidden sections outright, and it reflects the owner's privacy switches in
what it contains rather than in what the page chooses to draw.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from app.models.enums import FontId, Ground, ThemeId
from app.schemas.common import CamelModel
from app.schemas.portfolio import HeaderOut, Layout
from app.schemas.section import SectionOut


class PublicPortfolioOut(CamelModel):
    id: uuid.UUID
    name: str
    slug: str
    theme: ThemeId
    accent: str
    ground: Ground
    ground_hex: str
    font: FontId
    body_font: FontId
    layout: Layout
    header: HeaderOut
    sections: list[SectionOut]
    published_at: datetime | None

    #: From the owner's privacy switches, so the page does not have to fetch
    #: them separately and cannot disagree with the server about them.
    noindex: bool
    badge: bool
    show_contact: bool


class RecordViewRequest(CamelModel):
    referrer: str = ""
    #: One page load's identifier. Repeats collapse to a single view, which is
    #: what stops a refresh loop or a retried request inflating the count.
    dedupe_key: str = ""


class RecordClickRequest(CamelModel):
    section_id: uuid.UUID
    url: str = ""
