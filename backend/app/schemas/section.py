"""Section payloads.

Every section is the same four fields — title, description, tab, links — so
there is nothing to learn twice. The rest is opt-in and may be absent.

``tab`` is the exception to "opt-in": a section is reached through its tab and
nowhere else, so it is required and can never be blank.

``Stat`` and ``DateEntry`` live here because this is where they were first
needed; they hang off the header now — see ``app/schemas/portfolio.py``.
"""

from __future__ import annotations

import uuid

from pydantic import Field, field_validator

from app.models.enums import TAB_MAX_LENGTH
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
    tab: str
    links: list[LinkItem]
    quote: Quote | None
    hidden: bool
    image: AssetOut | None
    file: AssetOut | None


class SectionCreate(StrictCamelModel):
    """No fields, on purpose.

    A section has no type to choose: every one is the same fields underneath.
    The model stays so the endpoint keeps rejecting a body it does not
    understand — a client still sending the retired ``kind`` is told, rather
    than having it dropped without a word.
    """


class SectionPatch(StrictCamelModel):
    title: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=20_000)
    #: Never an empty string: a blank tab would take the section off the
    #: page altogether, so there is no way to ask for one.
    tab: str | None = Field(default=None, min_length=1, max_length=TAB_MAX_LENGTH)
    links: list[LinkItem] | None = Field(default=None, max_length=60)
    # Explicitly nullable: null clears the quote, absent leaves it alone.
    quote: Quote | None = None
    hidden: bool | None = None
    image_asset_id: uuid.UUID | None = None
    file_asset_id: uuid.UUID | None = None
    clear_image: bool = False
    clear_file: bool = False

    @field_validator("tab")
    @classmethod
    def _tab_is_not_blank(cls, value: str | None) -> str | None:
        """Spaces are not a tab name. Trim, then insist on something left."""
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("A section needs a tab.")
        return trimmed


class SectionMove(StrictCamelModel):
    delta: int = Field(ge=-1, le=1)


class SectionOrder(StrictCamelModel):
    ids: list[uuid.UUID] = Field(min_length=1)
