"""Portfolio CRUD, slug availability, publish and unpublish."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, OwnedPortfolio, SessionDep
from app.api.route import TransactionRoute
from app.schemas.common import ERROR_RESPONSES
from app.schemas.portfolio import (
    HeaderPatch,
    PortfolioCreate,
    PortfolioOut,
    PortfolioPatch,
    PortfolioSummaryOut,
    SlugAvailableOut,
    SlugField,
)
from app.services.portfolio import PortfolioService

router = APIRouter(
    prefix="/portfolios",
    tags=["portfolios"],
    responses=ERROR_RESPONSES,
    route_class=TransactionRoute,
)


@router.get(
    "",
    response_model=None,
    summary="Your portfolios",
    description=(
        "Summaries by default. Pass `expand=sections` for the full documents "
        "— what /print and /stats need, in one request rather than one per row."
    ),
)
async def list_portfolios(
    session: SessionDep,
    user: CurrentUser,
    expand: Literal["sections"] | None = Query(default=None),
) -> list[PortfolioOut] | list[PortfolioSummaryOut]:
    service = PortfolioService(session)
    if expand == "sections":
        return await service.list_full_for(user)
    return await service.list_for(user)


# Registered before /{portfolio_id} so this literal path is not swallowed by
# the UUID route and rejected as a malformed id.
@router.get("/slug-available", response_model=SlugAvailableOut, summary="Is an address free?")
async def slug_available(
    session: SessionDep,
    user: CurrentUser,
    slug: SlugField = Query(description="The address to check, without the facet.page/ prefix"),
) -> SlugAvailableOut:
    available = await PortfolioService(session).slug_available(slug)
    return SlugAvailableOut(slug=slug, available=available)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=PortfolioOut,
    summary="Create a portfolio",
)
async def create_portfolio(
    payload: PortfolioCreate, session: SessionDep, user: CurrentUser
) -> PortfolioOut:
    service = PortfolioService(session)
    portfolio = await service.create(user, payload)
    return service.to_out(portfolio)


@router.get("/{portfolio_id}", response_model=PortfolioOut, summary="One portfolio in full")
async def read_portfolio(portfolio: OwnedPortfolio, session: SessionDep) -> PortfolioOut:
    return PortfolioService(session).to_out(portfolio)


@router.patch("/{portfolio_id}", response_model=PortfolioOut, summary="Edit a portfolio")
async def update_portfolio(
    payload: PortfolioPatch, portfolio: OwnedPortfolio, session: SessionDep
) -> PortfolioOut:
    service = PortfolioService(session)
    return service.to_out(await service.update(portfolio, payload))


@router.patch(
    "/{portfolio_id}/header", response_model=PortfolioOut, summary="Edit the header"
)
async def update_header(
    payload: HeaderPatch, portfolio: OwnedPortfolio, session: SessionDep
) -> PortfolioOut:
    service = PortfolioService(session)
    return service.to_out(await service.update_header(portfolio, payload))


@router.post("/{portfolio_id}/publish", response_model=PortfolioOut, summary="Publish")
async def publish(portfolio: OwnedPortfolio, session: SessionDep) -> PortfolioOut:
    service = PortfolioService(session)
    return service.to_out(await service.publish(portfolio))


@router.post("/{portfolio_id}/unpublish", response_model=PortfolioOut, summary="Unpublish")
async def unpublish(portfolio: OwnedPortfolio, session: SessionDep) -> PortfolioOut:
    service = PortfolioService(session)
    return service.to_out(await service.unpublish(portfolio))


@router.delete(
    "/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a portfolio"
)
async def delete_portfolio(portfolio: OwnedPortfolio, session: SessionDep) -> None:
    await PortfolioService(session).delete(portfolio)
