"""Counting real visits.

Every figure on /stats comes from a row in ``page_views`` or ``link_clicks``
that some visitor actually caused. Nothing here estimates, projects or fills
in. An empty result stays empty.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ids import new_id
from app.models import AccountSettings, LinkClick, PageView, Portfolio, User
from app.schemas.analytics import SummaryOut, Totals


def source_from_referrer(referrer: str) -> str:
    """Bucket a referrer the same way src/lib/analytics.ts does."""
    if not referrer:
        return "Direct"

    try:
        host = urlsplit(referrer).hostname or ""
    except ValueError:
        return "Direct"
    if not host:
        return "Direct"

    host = host.removeprefix("www.")

    if "whatsapp" in host:
        return "WhatsApp"
    if "linkedin" in host:
        return "LinkedIn"
    if "t.co" in host or "twitter" in host or host == "x.com":
        return "X"
    if "mail" in host or "gmail" in host:
        return "Email"
    if "localhost" in host or "facet.page" in host:
        return "Direct"
    return host


class AnalyticsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── recording ───────────────────────────────────────────────────────

    async def _counting_allowed(self, portfolio: Portfolio) -> bool:
        settings = await self.session.scalar(
            select(AccountSettings).where(AccountSettings.user_id == portfolio.user_id)
        )
        if settings is None:
            return False
        # The owner's "Count visits" switch. Off means no row is written at
        # all — not written and hidden.
        return bool((settings.privacy or {}).get("countVisits", True))

    async def record_view(
        self, portfolio: Portfolio, referrer: str, dedupe_key: str
    ) -> bool:
        if not await self._counting_allowed(portfolio):
            return False

        host = urlsplit(referrer).hostname if referrer else None
        key = dedupe_key or str(new_id())

        # ON CONFLICT DO NOTHING against the (portfolio, dedupe_key) unique
        # index: the server-side equivalent of the frontend's per-load guard.
        statement = (
            insert(PageView)
            .values(
                id=new_id(),
                portfolio_id=portfolio.id,
                source=source_from_referrer(referrer),
                referrer_host=host,
                dedupe_key=key,
                occurred_at=datetime.now(UTC),
            )
            .on_conflict_do_nothing(index_elements=["portfolio_id", "dedupe_key"])
        )
        result = await self.session.execute(statement)
        return bool(result.rowcount)

    async def record_click(
        self, portfolio: Portfolio, section_id: uuid.UUID, url: str
    ) -> bool:
        if not await self._counting_allowed(portfolio):
            return False

        self.session.add(
            LinkClick(
                portfolio_id=portfolio.id,
                section_id=section_id,
                target_url=url or None,
                occurred_at=datetime.now(UTC),
            )
        )
        await self.session.flush()
        return True

    # ── reading ─────────────────────────────────────────────────────────

    async def summary(self, user: User, days: int = 30) -> SummaryOut:
        since = datetime.now(UTC) - timedelta(days=days)

        views: dict[str, int] = {}
        sources: dict[str, dict[str, int]] = {}
        clicks: dict[str, dict[str, int]] = {}

        # Grouped in SQL rather than looped over in Python: the number of
        # events is unbounded, the number of groups is not.
        view_rows = await self.session.execute(
            select(Portfolio.slug, PageView.source, func.count(PageView.id))
            .join(PageView, PageView.portfolio_id == Portfolio.id)
            .where(Portfolio.user_id == user.id, PageView.occurred_at >= since)
            .group_by(Portfolio.slug, PageView.source)
        )
        for slug, source, count in view_rows.all():
            views[slug] = views.get(slug, 0) + count
            sources.setdefault(slug, {})[source] = count

        click_rows = await self.session.execute(
            select(Portfolio.slug, LinkClick.section_id, func.count(LinkClick.id))
            .join(LinkClick, LinkClick.portfolio_id == Portfolio.id)
            .where(Portfolio.user_id == user.id, LinkClick.occurred_at >= since)
            .group_by(Portfolio.slug, LinkClick.section_id)
        )
        for slug, section_id, count in click_rows.all():
            clicks.setdefault(slug, {})[str(section_id)] = count

        return SummaryOut(
            views=views,
            clicks=clicks,
            sources=sources,
            totals=Totals(
                views=sum(views.values()),
                clicks=sum(sum(row.values()) for row in clicks.values()),
            ),
        )

    async def reset(self, user: User) -> None:
        owned = select(Portfolio.id).where(Portfolio.user_id == user.id)
        await self.session.execute(
            delete(PageView).where(PageView.portfolio_id.in_(owned))
        )
        await self.session.execute(
            delete(LinkClick).where(LinkClick.portfolio_id.in_(owned))
        )
        await self.session.flush()
