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

The section's own fields are placed the same way. ``text`` places its
description and cover picture, ``links`` its links and ``quote`` its pull
quote: the values stay on the section's own columns, where the themes, the
resume and the ATS check read them, and the component says the section has
them. A section holds at most one of each.

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
from app.schemas.common import SafeUrl, StrictCamelModel
from app.schemas.resume_items import (
    Award,
    Certification,
    EducationItem,
    ExperienceItem,
    Language,
    SkillGroup,
)

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
    url: SafeUrl = ""


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
    #: "Print on your resume": whether the component prints under its
    #: section's title on the resume. ``None`` is a component stored before
    #: the switch was each component's; ``prints_on_resume()`` in
    #: app/services/ats.py and ``sectionOf()`` in src/lib/types.ts resolve it
    #: the same way. A gallery never prints, whatever this says.
    on_resume: bool | None = Field(default=None, exclude_if=lambda v: v is None)


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


class TextBlock(_Block):
    """Places the section's description and cover picture. Holds neither."""

    type: Literal["text"]


class LinksBlock(_Block):
    """Places the section's links. Holds none."""

    type: Literal["links"]


class QuoteBlock(_Block):
    """Places the section's pull quote. Holds none."""

    type: Literal["quote"]


class _ListBlock(_Block):
    """One of the resume's lists, in this section, holding its own entries.

    Each component is its own list: a second Experience component starts
    empty and keeps its own roles. (Before migration ``e8b4d1a7c3f2`` the
    entries were one list per kind in ``portfolios.resume``, which every
    component of that kind placed.) The entries are structured, not prose,
    so the resume templates and the ATS check read a role and its dates.
    """

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


class ExperienceBlock(_ListBlock):
    type: Literal["experience"]
    items: list[ExperienceItem] = Field(default_factory=list, max_length=40)


class EducationBlock(_ListBlock):
    type: Literal["education"]
    items: list[EducationItem] = Field(default_factory=list, max_length=20)


class SkillsBlock(_ListBlock):
    type: Literal["skills"]
    items: list[SkillGroup] = Field(default_factory=list, max_length=20)


class CertificationsBlock(_ListBlock):
    type: Literal["certifications"]
    items: list[Certification] = Field(default_factory=list, max_length=40)


class LanguagesBlock(_ListBlock):
    type: Literal["languages"]
    items: list[Language] = Field(default_factory=list, max_length=20)


class AwardsBlock(_ListBlock):
    type: Literal["awards"]
    items: list[Award] = Field(default_factory=list, max_length=40)


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
    cta_url: SafeUrl = ""
    #: Whether to draw the compose form, or only the details.
    form: bool = True


Block = Annotated[
    TextBlock
    | LinksBlock
    | QuoteBlock
    | GalleryBlock
    | TimelineBlock
    | TestimonialsBlock
    | ClientsBlock
    | TabsBlock
    | StatsBlock
    | ServicesBlock
    | FaqBlock
    | ContactBlock
    | ExperienceBlock
    | EducationBlock
    | SkillsBlock
    | CertificationsBlock
    | LanguagesBlock
    | AwardsBlock,
    Field(discriminator="type"),
]


#: The resume's lists, as component types.
RESUME_LISTS = ("experience", "education", "skills", "certifications", "languages", "awards")


def fix_resume_switches(
    on_resume: bool, blocks: list[dict], hidden: list[str] | set[str]
) -> tuple[bool, list[dict]]:
    """A section from before "Print on your resume" was each component's,
    switched so the resume prints what it printed then.

    A list used to print whatever its section's Resume switch said — that
    switch only decided whether the section's own words printed. Now the
    section's switch decides whether anything under it prints, so a section
    that places a list but had the switch off is switched on, with each
    component told explicitly: its list prints unless the whole list was
    switched off (``hidden``), and nothing else under it does. Anything else
    is returned as it was. Migration ``c3e8a5f1b7d2`` does the same to rows
    already stored.
    """
    if on_resume or not any(b.get("type") in RESUME_LISTS for b in blocks):
        return on_resume, blocks
    fixed = []
    for b in blocks:
        if not isinstance(b.get("onResume"), bool):
            b = {**b, "onResume": b.get("type") in RESUME_LISTS and b.get("type") not in hidden}
        fixed.append(b)
    return True, fixed
