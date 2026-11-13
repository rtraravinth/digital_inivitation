"""Section components.

A section is title, description, links and images. A component is anything
under that a visitor recognises from public portfolio pages: a timeline, a
wall of client names, testimonials, a small tabbed panel, a row of numbers,
services, questions and answers, a way to get in touch.

Every component is ``{id, type, title, ...}`` plus its own ``items``. They are
a discriminated union on ``type`` so a misspelled field fails loudly rather
than saving as a component that renders nothing. Mirrors ``Block`` in
src/lib/types.ts.

None of them references an upload. A testimonial shows initials, a client is
a wordmark, and a gallery only *names* pictures by id — the pictures
themselves are the section's ``section_images`` rows, and an id the section
does not hold draws nothing. That keeps every asset reference a foreign key,
which is what asset release and the public asset route rely on.

The resume's lists — experience, education, skills, certifications,
languages, awards — are components in the same way a gallery is: the
component only *places* the list in a section and picks its look. The
entries stay in ``portfolios.resume``, structured, because a resume template
and a later ATS check read a role and its dates from there.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field

from app.models.enums import BLOCK_ITEMS_MAX, SECTION_IMAGES_MAX
from app.schemas.common import StrictCamelModel

_ID = Field(max_length=64)
_SHORT = Field(default="", max_length=200)
_LINE = Field(default="", max_length=500)
_TEXT = Field(default="", max_length=4000)


class TimelineItem(StrictCamelModel):
    id: str = _ID
    date: str = Field(default="", max_length=64)
    title: str = _SHORT
    text: str = _TEXT


class TestimonialItem(StrictCamelModel):
    id: str = _ID
    quote: str = _TEXT
    name: str = _SHORT
    role: str = _SHORT


class ClientItem(StrictCamelModel):
    id: str = _ID
    name: str = _SHORT
    url: str = Field(default="", max_length=2000)


class TabItem(StrictCamelModel):
    id: str = _ID
    label: str = Field(default="", max_length=60)
    text: str = _TEXT


class StatItem(StrictCamelModel):
    id: str = _ID
    value: str = Field(default="", max_length=64)
    label: str = _SHORT


class ServiceItem(StrictCamelModel):
    id: str = _ID
    title: str = _SHORT
    text: str = _TEXT
    #: Free text on purpose: "From ₹40,000", "Per session", "On request".
    price: str = Field(default="", max_length=64)


class FaqItem(StrictCamelModel):
    id: str = _ID
    question: str = _LINE
    answer: str = _TEXT


class _Block(StrictCamelModel):
    id: str = _ID
    #: An optional heading over the component, e.g. "Kind words".
    title: str = _SHORT


class GalleryBlock(_Block):
    """A set of the section's pictures, in the gallery's own order.

    ``image_ids`` are ids into the section's own images, never references of
    their own: the page resolves them against ``section.images`` and skips
    any it cannot find. The section's cover is the picture no gallery names.
    """

    type: Literal["gallery"]
    layout: Literal["mosaic", "grid", "strip"] = "mosaic"
    image_ids: list[Annotated[str, Field(max_length=64)]] = Field(
        default_factory=list, max_length=SECTION_IMAGES_MAX
    )


class ResumeListBlock(_Block):
    """One of the resume's lists, shown in this section.

    Holds no entries: they are ``portfolios.resume[type]``. A list reaches a
    visitor only while a component of its type sits in a section that is on
    the page — see ``public_resume``.
    """

    type: Literal["experience", "education", "skills", "certifications", "languages", "awards"]
    #: How the page draws it: one of the section styles, the same shapes the
    #: page's plain sections take. "theme" leaves it to the one that suits
    #: this kind of list. "cards" and "tags" are what "grid" and "chips" were
    #: called before lists were drawn by the section styles; they are still
    #: accepted so a stored component keeps validating.
    look: Literal[
        "theme",
        "grid",
        "timeline",
        "carousel",
        "tabs",
        "list",
        "spotlight",
        "chips",
        "cards",
        "tags",
    ] = "theme"


class TimelineBlock(_Block):
    type: Literal["timeline"]
    items: list[TimelineItem] = Field(default_factory=list, max_length=BLOCK_ITEMS_MAX)


class TestimonialsBlock(_Block):
    type: Literal["testimonials"]
    items: list[TestimonialItem] = Field(default_factory=list, max_length=BLOCK_ITEMS_MAX)


class ClientsBlock(_Block):
    type: Literal["clients"]
    items: list[ClientItem] = Field(default_factory=list, max_length=BLOCK_ITEMS_MAX)


class TabsBlock(_Block):
    type: Literal["tabs"]
    items: list[TabItem] = Field(default_factory=list, max_length=12)


class StatsBlock(_Block):
    type: Literal["stats"]
    items: list[StatItem] = Field(default_factory=list, max_length=12)


class ServicesBlock(_Block):
    type: Literal["services"]
    items: list[ServiceItem] = Field(default_factory=list, max_length=BLOCK_ITEMS_MAX)


class FaqBlock(_Block):
    type: Literal["faq"]
    items: list[FaqItem] = Field(default_factory=list, max_length=BLOCK_ITEMS_MAX)


class ContactBlock(_Block):
    """A way to get in touch.

    There is no mail service in this build, so the form a visitor fills in
    composes an email in their own mail app, addressed to ``email``. Nothing
    is sent or stored by the server.
    """

    type: Literal["contact"]
    text: str = _TEXT
    email: str = Field(default="", max_length=320)
    phone: str = Field(default="", max_length=64)
    location: str = _SHORT
    #: An optional booking link — a calendar page, say — and its label.
    cta_label: str = Field(default="", max_length=60)
    cta_url: str = Field(default="", max_length=2000)
    #: Whether to draw the compose form, or only the details.
    form: bool = True


Block = Annotated[
    GalleryBlock
    | TimelineBlock
    | TestimonialsBlock
    | ClientsBlock
    | TabsBlock
    | StatsBlock
    | ServicesBlock
    | FaqBlock
    | ContactBlock
    | ResumeListBlock,
    Field(discriminator="type"),
]
