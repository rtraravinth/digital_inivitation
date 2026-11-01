"""Analytics responses.

Keyed by slug, in the shape Stats.tsx already reads.
"""

from __future__ import annotations

from app.schemas.common import CamelModel


class Totals(CamelModel):
    views: int
    clicks: int


class DayCount(CamelModel):
    views: int = 0
    clicks: int = 0


class SummaryOut(CamelModel):
    #: slug -> view count
    views: dict[str, int]
    #: slug -> section id -> click count
    clicks: dict[str, dict[str, int]]
    #: slug -> source label -> view count
    sources: dict[str, dict[str, int]]
    #: slug -> UTC calendar day ("YYYY-MM-DD") -> that day's counts. Sparse: a
    #: day with nothing on it is absent rather than zero, and the client fills
    #: the gaps, because the window decides which days exist, not the events.
    daily: dict[str, dict[str, DayCount]] = {}
    totals: Totals
