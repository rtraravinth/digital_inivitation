"""The entries of the resume's lists: a role, a degree, a skill group, a
certification, a language, an award.

Their own module because two schemas hold them: each list component
(``app/schemas/blocks.py``) carries its own entries, and the stored resume
(``app/schemas/resume.py``) still accepts the lists it held before entries
moved into the components. Here, neither imports the other.
"""

from __future__ import annotations

from pydantic import Field

from app.schemas.common import SafeUrl, StrictCamelModel

_ID = Field(max_length=64)
_LINE = Field(default="", max_length=300)
_DATE = Field(default="", max_length=40)


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
