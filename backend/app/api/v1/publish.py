"""The public surface: what an unauthenticated visitor can reach.

No token, and no way to reach anything unpublished. The owner's privacy
switches are applied here, on the server, so turning one off removes data
from the response rather than hiding it in the page.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Response, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep
from app.api.route import TransactionRoute
from app.api.v1.assets import serve
from app.core.errors import NotFound
from app.models import AccountSettings, Asset, Portfolio, PortfolioHeader, Section
from app.schemas.common import ERROR_RESPONSES
from app.schemas.portfolio import Layout
from app.schemas.publish import (
    PublicPortfolioOut,
    RecordClickRequest,
    RecordViewRequest,
)
from app.services.analytics import AnalyticsService
from app.services.portfolio import header_out, section_out

router = APIRouter(
    prefix="/public",
    tags=["public"],
    responses=ERROR_RESPONSES,
    route_class=TransactionRoute,
)


async def _load_published(session: SessionDep, slug: str) -> tuple[Portfolio, dict]:
    """The published portfolio and its owner's privacy switches.

    One query with eager loads: a published page must not issue a query per
    section.
    """
    portfolio = await session.scalar(
        select(Portfolio)
        .where(Portfolio.slug == slug, Portfolio.status == "live")
        .options(
            selectinload(Portfolio.header),
            selectinload(Portfolio.sections).selectinload(Section.image),
            selectinload(Portfolio.sections).selectinload(Section.file),
        )
    )
    if portfolio is None:
        # Draft and non-existent are the same answer: a draft's existence is
        # not a visitor's business.
        raise NotFound("There is no page at that address.", code="page_not_found")

    settings = await session.scalar(
        select(AccountSettings).where(AccountSettings.user_id == portfolio.user_id)
    )
    return portfolio, dict(settings.privacy or {}) if settings else {}


@router.get(
    "/p/{slug:path}",
    response_model=PublicPortfolioOut,
    summary="Read a published page",
)
async def read_published(slug: str, session: SessionDep, response: Response):
    portfolio, privacy = await _load_published(session, slug)

    indexable = privacy.get("indexable", True)
    show_contact = privacy.get("showContact", True)
    badge = privacy.get("badge", True)

    if not indexable:
        # The page still opens for anyone with the link; it just asks not to
        # be indexed, which is what the switch promises.
        response.headers["X-Robots-Tag"] = "noindex, nofollow"

    return PublicPortfolioOut(
        id=portfolio.id,
        name=portfolio.name,
        slug=portfolio.slug,
        theme=portfolio.theme,
        accent=portfolio.accent,
        ground=portfolio.ground,
        font=portfolio.font,
        layout=Layout.model_validate(portfolio.layout),
        header=header_out(portfolio.header, public=True, links=show_contact),
        # Hidden sections never reach a visitor, whatever the theme does.
        sections=[
            section_out(section, public=True)
            for section in portfolio.sections
            if not section.hidden
        ],
        published_at=portfolio.published_at,
        noindex=not indexable,
        badge=badge,
        show_contact=show_contact,
    )


@router.post(
    "/p/{slug:path}/views",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Record a page view",
)
async def record_view(
    slug: str, payload: RecordViewRequest, session: SessionDep
) -> dict[str, bool]:
    portfolio, _ = await _load_published(session, slug)
    counted = await AnalyticsService(session).record_view(
        portfolio, payload.referrer, payload.dedupe_key
    )
    # 202 either way: a visitor must never see an analytics failure, and
    # "not counted" is a legitimate outcome when the owner turned it off.
    return {"counted": counted}


@router.post(
    "/p/{slug:path}/clicks",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Record a click on a section link",
)
async def record_click(
    slug: str, payload: RecordClickRequest, session: SessionDep
) -> dict[str, bool]:
    portfolio, _ = await _load_published(session, slug)
    counted = await AnalyticsService(session).record_click(
        portfolio, payload.section_id, payload.url
    )
    return {"counted": counted}


@router.get("/assets/{asset_id}", summary="An image on a published page")
async def read_public_asset(asset_id: uuid.UUID, session: SessionDep) -> Response:
    asset = await session.get(Asset, asset_id)
    if asset is None:
        raise NotFound("That upload does not exist.", code="asset_not_found")

    if not await _is_on_a_published_page(session, asset_id):
        # An asset that is merely uploaded, or attached only to a draft,
        # stays private. Same answer as a missing one.
        raise NotFound("That upload does not exist.", code="asset_not_found")

    return serve(asset, public=True)


async def _is_on_a_published_page(session: SessionDep, asset_id: uuid.UUID) -> bool:
    in_a_section = await session.scalar(
        select(Section.id)
        .join(Portfolio, Portfolio.id == Section.portfolio_id)
        .where(
            Portfolio.status == "live",
            Section.hidden.is_(False),
            (Section.image_asset_id == asset_id) | (Section.file_asset_id == asset_id),
        )
        .limit(1)
    )
    if in_a_section is not None:
        return True

    in_a_header = await session.scalar(
        select(PortfolioHeader.id)
        .join(Portfolio, Portfolio.id == PortfolioHeader.portfolio_id)
        .where(Portfolio.status == "live", PortfolioHeader.portrait_asset_id == asset_id)
        .limit(1)
    )
    return in_a_header is not None
