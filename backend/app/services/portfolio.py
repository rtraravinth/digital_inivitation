"""Portfolios: create, edit, publish, serialise."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound
from app.models import Asset, Portfolio, PortfolioHeader, Section, User
from app.models.portfolio import default_layout
from app.schemas.asset import asset_out
from app.schemas.portfolio import (
    HeaderOut,
    HeaderPatch,
    Layout,
    PortfolioCreate,
    PortfolioOut,
    PortfolioPatch,
    PortfolioSummaryOut,
)
from app.schemas.section import SectionOut

#: The third option in the create dialog, matching FOUNDER_TEMPLATE in
#: src/lib/store.tsx.
FOUNDER_TEMPLATE: list[tuple[str, str]] = [
    ("The company", "What it is, who it serves, and how far along it is."),
    ("What I did before", "The one or two things worth knowing."),
    ("How to work with me", "What you should get in touch about."),
]


def section_out(section: Section, *, public: bool = False) -> SectionOut:
    return SectionOut(
        id=section.id,
        title=section.title,
        description=section.description,
        tags=list(section.tags or []),
        links=list(section.links or []),
        numbers=list(section.numbers or []),
        dates=list(section.dates or []),
        quote=section.quote,
        hidden=section.hidden,
        kind=section.kind,
        image=asset_out(section.image, public=public),
        file=asset_out(section.file, public=public),
    )


def header_out(header: PortfolioHeader, *, public: bool = False, links: bool = True) -> HeaderOut:
    return HeaderOut(
        name=header.name,
        current=header.current,
        description=header.description,
        tags=list(header.tags or []),
        # When the owner has hidden contact details the links are absent from
        # the payload, not merely hidden by the page.
        links=list(header.links or []) if links else [],
        portrait=asset_out(header.portrait, public=public),
    )


def describe_meta(section_count: int, updated_at: datetime) -> str:
    """"3 sections · 2 days ago" — computed, so it can never go stale."""
    plural = "" if section_count == 1 else "s"
    return f"{section_count} section{plural} · {relative_time(updated_at)}"


def relative_time(moment: datetime) -> str:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)

    seconds = (datetime.now(UTC) - moment).total_seconds()
    if seconds < 90:
        return "just now"
    if seconds < 3600:
        return f"{int(seconds // 60)} minutes ago"
    if seconds < 86_400:
        hours = int(seconds // 3600)
        return f"{hours} hour{'' if hours == 1 else 's'} ago"

    days = int(seconds // 86_400)
    if days < 30:
        return f"{days} day{'' if days == 1 else 's'} ago"
    months = days // 30
    return f"{months} month{'' if months == 1 else 's'} ago"


class PortfolioService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── serialisation ───────────────────────────────────────────────────

    def to_out(self, portfolio: Portfolio) -> PortfolioOut:
        return PortfolioOut(
            id=portfolio.id,
            name=portfolio.name,
            slug=portfolio.slug,
            status=portfolio.status,
            summary=portfolio.summary,
            meta=describe_meta(len(portfolio.sections), portfolio.updated_at),
            theme=portfolio.theme,
            accent=portfolio.accent,
            ground=portfolio.ground,
            font=portfolio.font,
            layout=Layout.model_validate(portfolio.layout),
            header=header_out(portfolio.header),
            sections=[section_out(section) for section in portfolio.sections],
            published_at=portfolio.published_at,
            updated_at=portfolio.updated_at,
        )

    # ── reads ───────────────────────────────────────────────────────────

    async def list_for(self, user: User) -> list[PortfolioSummaryOut]:
        counts = (
            select(Section.portfolio_id, func.count(Section.id).label("total"))
            .group_by(Section.portfolio_id)
            .subquery()
        )
        rows = await self.session.execute(
            select(Portfolio, func.coalesce(counts.c.total, 0))
            .outerjoin(counts, counts.c.portfolio_id == Portfolio.id)
            .where(Portfolio.user_id == user.id)
            .order_by(Portfolio.created_at.desc())
        )

        return [
            PortfolioSummaryOut(
                id=portfolio.id,
                name=portfolio.name,
                slug=portfolio.slug,
                status=portfolio.status,
                summary=portfolio.summary,
                meta=describe_meta(total, portfolio.updated_at),
                theme=portfolio.theme,
                accent=portfolio.accent,
                ground=portfolio.ground,
                font=portfolio.font,
                section_count=total,
                published_at=portfolio.published_at,
                updated_at=portfolio.updated_at,
            )
            for portfolio, total in rows.all()
        ]

    async def slug_available(self, slug: str, *, exclude_id: uuid.UUID | None = None) -> bool:
        query = select(Portfolio.id).where(Portfolio.slug == slug)
        if exclude_id is not None:
            query = query.where(Portfolio.id != exclude_id)
        return await self.session.scalar(query) is None

    async def _assert_slug_free(self, slug: str, *, exclude_id: uuid.UUID | None = None) -> None:
        if not await self.slug_available(slug, exclude_id=exclude_id):
            # Slugs are global: facet.page/<slug> has nothing in front of it,
            # so two accounts cannot both hold one.
            raise Conflict(
                "That address is already in use.", code="slug_taken", details={"slug": slug}
            )

    # ── writes ──────────────────────────────────────────────────────────

    async def create(self, user: User, payload: PortfolioCreate) -> Portfolio:
        await self._assert_slug_free(payload.slug)

        portfolio = Portfolio(
            user_id=user.id,
            name=payload.name,
            slug=payload.slug,
            status="empty",
            summary="Not published yet.",
            layout=default_layout(),
        )
        portfolio.header = PortfolioHeader(tags=[], links=[])
        portfolio.sections = await self._starting_sections(user, payload)

        self.session.add(portfolio)
        await self.session.flush()
        await self.session.refresh(portfolio)
        return portfolio

    async def _starting_sections(self, user: User, payload: PortfolioCreate) -> list[Section]:
        start = payload.start_from

        if start.kind == "founder":
            return [
                Section(position=index, title=title, description=description,
                        tags=[], links=[], numbers=[], dates=[])
                for index, (title, description) in enumerate(FOUNDER_TEMPLATE)
            ]

        if start.kind == "copy":
            source = await self.session.scalar(
                select(Portfolio).where(Portfolio.id == start.id, Portfolio.user_id == user.id)
            )
            if source is None:
                raise NotFound("That portfolio does not exist.", code="portfolio_not_found")
            # New rows with new ids: a copy that shared ids would not be a copy.
            return [
                Section(
                    position=index,
                    title=section.title,
                    description=section.description,
                    tags=list(section.tags or []),
                    links=list(section.links or []),
                    numbers=list(section.numbers or []),
                    dates=list(section.dates or []),
                    quote=section.quote,
                    hidden=section.hidden,
                    kind=section.kind,
                    image_asset_id=section.image_asset_id,
                    file_asset_id=section.file_asset_id,
                )
                for index, section in enumerate(source.sections)
            ]

        return [Section(position=0, tags=[], links=[], numbers=[], dates=[])]

    async def update(self, portfolio: Portfolio, patch: PortfolioPatch) -> Portfolio:
        changes = patch.model_dump(exclude_unset=True, exclude_none=True)

        if "slug" in changes:
            await self._assert_slug_free(changes["slug"], exclude_id=portfolio.id)

        for field in ("name", "slug", "summary", "theme", "accent", "ground", "font"):
            if field in changes:
                setattr(portfolio, field, changes[field])

        if patch.layout is not None:
            portfolio.layout = patch.layout.model_dump(by_alias=True)

        await self._touch(portfolio)
        return portfolio

    async def update_header(self, portfolio: Portfolio, patch: HeaderPatch) -> Portfolio:
        header = portfolio.header

        for field in ("name", "current", "description"):
            value = getattr(patch, field)
            if value is not None:
                setattr(header, field, value)

        if patch.tags is not None:
            header.tags = list(patch.tags)
        if patch.links is not None:
            header.links = [link.model_dump(by_alias=True) for link in patch.links]

        portrait_changed = patch.clear_portrait or patch.portrait_asset_id is not None
        if patch.clear_portrait:
            header.portrait_asset_id = None
        elif patch.portrait_asset_id is not None:
            await self._assert_owns_asset(portfolio.user_id, patch.portrait_asset_id)
            header.portrait_asset_id = patch.portrait_asset_id

        await self._touch(portfolio)

        if portrait_changed:
            # The relationship was loaded before the foreign key changed.
            # Reload it here, where awaiting is allowed — reading it during
            # response serialisation would lazy-load outside the greenlet.
            await self.session.refresh(header, ["portrait"])

        return portfolio

    async def _assert_owns_asset(self, user_id: uuid.UUID, asset_id: uuid.UUID) -> Asset:
        asset = await self.session.scalar(
            select(Asset).where(Asset.id == asset_id, Asset.user_id == user_id)
        )
        if asset is None:
            raise NotFound("That upload does not exist.", code="asset_not_found")
        return asset

    async def publish(self, portfolio: Portfolio) -> Portfolio:
        portfolio.status = "live"
        portfolio.published_at = datetime.now(UTC)
        portfolio.summary = "Live."
        await self._touch(portfolio)
        return portfolio

    async def unpublish(self, portfolio: Portfolio) -> Portfolio:
        portfolio.status = "draft"
        portfolio.published_at = None
        portfolio.summary = "Not published."
        await self._touch(portfolio)
        return portfolio

    async def delete(self, portfolio: Portfolio) -> None:
        await self.session.delete(portfolio)
        await self.session.flush()

    async def _touch(self, portfolio: Portfolio) -> None:
        portfolio.updated_at = datetime.now(UTC)
        await self.session.flush()
        await self.session.refresh(portfolio)
