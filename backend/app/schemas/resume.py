"""The resume a portfolio prints as.

A portfolio has one set of content and two looks: the page it publishes and
the resume it downloads. The header is shared — its name, current line and
About are the resume's name, headline and summary — so nothing is typed
twice. What lives here are the facts a page section has no fields for: a
job's company and dates, a degree's school, a list of skills. Structured
rather than free text, so a later ATS check can read a role and its dates
without parsing prose.

Each structured list can also appear on the published page, by placing a
component of its type in a section (``ResumeListBlock`` in
app/schemas/blocks.py). Only lists placed in a section a visitor can see
ever leave the owner's account — see ``public_resume`` — because the rest
carries an email and a phone number.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any, Literal

from pydantic import Field, ValidationError

from app.models.enums import FontId
from app.schemas.common import CamelModel, SafeUrl, StrictCamelModel

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

_ID = Field(max_length=64)
_LINE = Field(default="", max_length=300)
_DATE = Field(default="", max_length=40)


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


class ExperienceItem(StrictCamelModel):
    id: str = _ID
    role: str = _LINE
    company: str = _LINE
    location: str = _LINE
    start: str = _DATE
    end: str = _DATE
    #: "Present" without typing it, and a later ATS check can tell a current
    #: role from one whose end date was simply left blank.
    current: bool = False
    bullets: list[str] = Field(default_factory=list, max_length=20)


class EducationItem(StrictCamelModel):
    id: str = _ID
    degree: str = _LINE
    school: str = _LINE
    location: str = _LINE
    start: str = _DATE
    end: str = _DATE
    detail: str = Field(default="", max_length=1000)


class SkillGroup(StrictCamelModel):
    id: str = _ID
    #: Optional: an unnamed group prints as a plain list.
    name: str = Field(default="", max_length=120)
    items: list[str] = Field(default_factory=list, max_length=60)


class Certification(StrictCamelModel):
    id: str = _ID
    name: str = _LINE
    issuer: str = _LINE
    date: str = _DATE
    url: SafeUrl = ""


class Language(StrictCamelModel):
    id: str = _ID
    name: str = Field(default="", max_length=120)
    level: str = Field(default="", max_length=120)


class Award(StrictCamelModel):
    id: str = _ID
    title: str = _LINE
    issuer: str = _LINE
    date: str = _DATE
    detail: str = Field(default="", max_length=1000)


class Resume(StrictCamelModel):
    #: Resume-only: printed on the resume, never sent to a visitor.
    email: str = Field(default="", max_length=320)
    phone: str = Field(default="", max_length=60)
    location: str = Field(default="", max_length=200)
    website: str = Field(default="", max_length=2000)

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


#: What a resume edit may change while the page is live: how the resume
#: looks and which blocks it prints. Everything else can reach the page.
RESUME_ONLY_FIELDS = {"style", "hidden", "email", "phone", "location", "website"}


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
    """The resume lists a visitor may see: only those placed in a section
    that is on the page, and never the contact details or the style."""

    experience: list[ExperienceItem]
    education: list[EducationItem]
    skills: list[SkillGroup]
    certifications: list[Certification]
    languages: list[Language]
    awards: list[Award]


def placed_lists(sections_blocks: Iterable[list | None]) -> set[str]:
    """The resume lists that have a component among these sections' blocks.

    Hand it the blocks of the sections a visitor will see — a list whose
    only component sits in a hidden section stays in the account.
    """
    return {
        block.get("type")
        for blocks in sections_blocks
        for block in (blocks or [])
        if isinstance(block, dict) and block.get("type") in PAGE_BLOCKS
    }


def public_resume(raw: Any, placed: set[str]) -> PublicResume:
    resume = resume_from_stored(raw)
    return PublicResume(
        **{block: getattr(resume, block) if block in placed else [] for block in PAGE_BLOCKS},
    )


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
