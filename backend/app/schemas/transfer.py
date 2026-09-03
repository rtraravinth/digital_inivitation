"""Export and import.

The export array is shaped like the localStorage build's ``exportAll()``, so
a file exported before this backend existed still imports into it. That is
the whole point of the format: it is a migration path, not a new interchange
standard.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from app.schemas.common import CamelModel


class ImportRequest(CamelModel):
    #: ``replace`` clears what is there first; ``merge`` keeps it and renames
    #: any clashing slug rather than failing the whole file.
    mode: Literal["replace", "merge"] = "merge"
    portfolios: list[dict[str, Any]] = Field(default_factory=list)


class ImportResultOut(CamelModel):
    imported: int
    skipped: int = 0
    #: Slugs that had to be renamed to avoid a collision, old -> new.
    renamed: dict[str, str] = Field(default_factory=dict)
