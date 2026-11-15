"""The resume a portfolio prints as.

A portfolio has one set of content and two looks: the page it publishes and
the resume it downloads. The header is shared — its name, current line and
About are the resume's name, headline and summary — so nothing is typed
twice. What lives here are the facts a page section has no fields for: a
job's company and dates, a degree's school, a list of skills. Structured
rather than free text, so a later ATS check can read a role and its dates
without parsing prose.

The structured lists themselves now live in the list components, each with
its own entries (``ExperienceBlock`` and the rest in app/schemas/blocks.py).
The lists this model still accepts are what a resume held before that;
migration ``e8b4d1a7c3f2`` moved them into the components and emptied them,
and an import does the same (``services/transfer.py``).
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import Field, ValidationError

from app.models.enums import FontId
from app.schemas.account import LinkItem
from app.schemas.asset import AssetOut
from app.schemas.common import CamelModel, StrictCamelModel
from app.schemas.resume_items import (
    Award,
    Certification,
    EducationItem,
    ExperienceItem,
    Language,
    SkillGroup,
)
from app.schemas.section import SectionOut

#: Mirrors ``RESUME_TEMPLATE_IDS`` in src/lib/types.ts. A template is only a
#: look, so adding one needs no migration — but an id the frontend sends must
#: be listed here, or the save is a 422.
ResumeTemplate = Literal[
    "classic",
    "ivy",
    "timeline",
    "compact",
    "sidebar",
    "modern",
    "executive",
    "scholar",
    "minimal",
    "swiss",
    "banner",
    "slate",
    "vivid",
    "engineer",
    "elegant",
    "bold",
    "contemporary",
    "corporate",
    "startup",
    "columns",
    "simple",
    "graduate",
    "senior",
    "portrait",
    "chronicle",
    "pathway",
    "nordic",
    "editorial",
    "ledger",
    "monogram",
    "cobalt",
    "harbor",
]
Paper = Literal["a4", "letter"]
ResumeSize = Literal["small", "medium", "large"]
ResumeSpacing = Literal["compact", "standard", "airy"]
#: ``auto`` follows the template's own columns.
ResumeColumns = Literal["auto", "one", "left", "right", "half"]
#: Mirrors ``RESUME_BACKDROP_IDS`` in src/lib/types.ts — decoration only.
ResumeBackdrop = Literal[
    "none",
    "dots",
    "grid",
    "diagonal",
    "hexagons",
    "topography",
    "waves",
    "triangles",
    "plus",
    "edge",
    "cream",
    "wash",
    "rainbow",
    "arcs",
    "circles",
    "lines",
]
ResumeBlock = Literal[
    "summary",
    "experience",
    "education",
    "projects",
    "skills",
    "certifications",
    "languages",
    "awards",
]
#: The order a new resume prints its blocks in: what a recruiter reads first.
DEFAULT_ORDER: list[str] = [
    "summary",
    "experience",
    "education",
    "projects",
    "skills",
    "certifications",
    "languages",
    "awards",
]
PAGE_BLOCKS: list[str] = [
    "experience",
    "education",
    "skills",
    "certifications",
    "languages",
    "awards",
]


class ResumeStyle(StrictCamelModel):
    template: ResumeTemplate = "classic"
    paper: Paper = "a4"
    accent: str = Field(default="#1d3f8a", pattern=r"^#[0-9a-fA-F]{6}$")
    heading_font: FontId = "inter"
    font: FontId = "inter"
    size: ResumeSize = "medium"
    spacing: ResumeSpacing = "standard"
    photo: bool = False
    columns: ResumeColumns = "auto"
    backdrop: ResumeBackdrop = "none"
    #: The background pattern's own colour. Empty means "the accent", which
    #: is what every resume stored before this existed gets.
    backdrop_color: str = Field(default="", pattern=r"^(#[0-9a-fA-F]{6})?$")


class PublicContact(StrictCamelModel):
    """Which contact details a published resume shows. All on by default, so a
    resume stored before the ticks existed behaves as the owner expects once
    they publish it: the details they typed are the ones printed."""

    email: bool = True
    phone: bool = True
    location: bool = True
    website: bool = True


class Resume(StrictCamelModel):
    #: Resume-only: printed on the resume; sent to a visitor only when ticked
    #: in ``public_contact`` on a published resume.
    email: str = Field(default="", max_length=320)
    phone: str = Field(default="", max_length=60)
    location: str = Field(default="", max_length=200)
    website: str = Field(default="", max_length=2000)
    #: Which of the four a published resume shows to a visitor.
    public_contact: PublicContact = Field(default_factory=PublicContact)

    experience: list[ExperienceItem] = Field(default_factory=list, max_length=40)
    education: list[EducationItem] = Field(default_factory=list, max_length=20)
    skills: list[SkillGroup] = Field(default_factory=list, max_length=20)
    certifications: list[Certification] = Field(default_factory=list, max_length=40)
    languages: list[Language] = Field(default_factory=list, max_length=20)
    awards: list[Award] = Field(default_factory=list, max_length=40)

    #: Block order on the sheet.
    order: list[ResumeBlock] = Field(default_factory=lambda: list(DEFAULT_ORDER), max_length=8)
    #: Blocks left off the resume.
    hidden: list[ResumeBlock] = Field(default_factory=list, max_length=8)
    style: ResumeStyle = Field(default_factory=ResumeStyle)


#: What a resume edit may change while the page or the resume is live: how the resume
#: looks and which blocks it prints. Everything else can reach the page.
RESUME_ONLY_FIELDS = {"style", "hidden", "email", "phone", "location", "website", "public_contact"}


def _known(model: type[StrictCamelModel], data: Any) -> dict:
    """``data`` without keys the model no longer has, by alias or by name."""
    if not isinstance(data, dict):
        return {}
    allowed = set()
    for name, field in model.model_fields.items():
        allowed.add(name)
        if field.alias:
            allowed.add(field.alias)
    return {key: value for key, value in data.items() if key in allowed}


def resume_from_stored(raw: Any) -> Resume:
    """The stored JSON as a resume, whatever build wrote it.

    Rows from before resumes existed hold ``{}``, which validates to the
    defaults. Keys a later build dropped (the old ``headline`` and
    ``summary``, which moved to the header) are ignored rather than failing
    validation; anything still invalid falls back to the defaults, because
    one bad field must not make a page impossible to open.
    """
    data = _known(Resume, raw)
    if "style" in data:
        data["style"] = _known(ResumeStyle, data["style"])
    try:
        resume = Resume.model_validate(data)
    except ValidationError:
        resume = Resume()
    # Every block exactly once: a block added in a later build is appended,
    # so an old resume never silently loses it.
    order = list(dict.fromkeys(resume.order))
    order += [block for block in DEFAULT_ORDER if block not in order]
    resume.order = order  # type: ignore[assignment]
    return resume


class PublicResume(CamelModel):
    """The resume lists a published page carries: always empty now.

    Each list component holds its own entries (``app/schemas/blocks.py``), so
    a page's lists reach a visitor inside the sections they sit in — a hidden
    section is never sent — and nothing of the stored resume is. The field
    stays so the page's payload keeps its shape for the frontend.
    """

    experience: list[ExperienceItem] = Field(default_factory=list)
    education: list[EducationItem] = Field(default_factory=list)
    skills: list[SkillGroup] = Field(default_factory=list)
    certifications: list[Certification] = Field(default_factory=list)
    languages: list[Language] = Field(default_factory=list)
    awards: list[Award] = Field(default_factory=list)


class AtsCheckIn(StrictCamelModel):
    """A job description to check the resume against. Read, never stored."""

    job_description: str = Field(min_length=40, max_length=20000)


class AtsPart(CamelModel):
    key: str
    label: str
    points: int
    out_of: int
    detail: str


class AtsTerm(CamelModel):
    term: str
    kind: Literal["hard", "soft", "keyword"]
    #: Where on the resume it was found: headline, summary, skills, experience…
    where: list[str]


class AtsSuggestion(CamelModel):
    id: str
    #: What clicking it does. "tip" only advises; the others change the resume.
    kind: Literal["add_skill", "use_title", "show_block", "tip"]
    title: str
    detail: str
    value: str = ""


class AtsReport(CamelModel):
    score: int
    breakdown: list[AtsPart]
    title: str
    matched: list[AtsTerm]
    missing: list[AtsTerm]
    suggestions: list[AtsSuggestion]


class PublicResumeHeader(CamelModel):
    name: str
    current: str
    description: str
    links: list[LinkItem]
    portrait: AssetOut | None


class PublicResumeOut(CamelModel):
    """A published resume: what ``/p/{subdomain}/{slug}/resume`` returns.

    The contact details the owner left unticked are sent as empty strings, so
    they are absent from the response rather than hidden by the page.
    """

    name: str
    slug: str
    subdomain: str
    header: PublicResumeHeader
    sections: list[SectionOut]
    resume: Resume
