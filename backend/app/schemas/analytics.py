"""Analytics responses.

Keyed by slug, in the shape Stats.tsx already reads.
"""

from __future__ import annotations

from app.schemas.common import CamelModel


class Totals(CamelModel):
    views: int
    clicks: int


class SummaryOut(CamelModel):
    #: slug -> view count
    views: dict[str, int]
    #: slug -> section id -> click count
    clicks: dict[str, dict[str, int]]
    #: slug -> source label -> view count
    sources: dict[str, dict[str, int]]
    totals: Totals
