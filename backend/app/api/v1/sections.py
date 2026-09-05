"""Sections, always addressed through the portfolio that owns them.

Nesting the path is what makes ownership unforgeable: reaching a section
means passing the portfolio's ownership check first.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.api.deps import EditablePortfolio, SessionDep
from app.api.route import TransactionRoute
from app.schemas.common import ERROR_RESPONSES
from app.schemas.portfolio import PortfolioOut
from app.schemas.section import (
    SectionCreate,
    SectionMove,
    SectionOrder,
    SectionOut,
    SectionPatch,
)
from app.services.portfolio import PortfolioService, section_out
from app.services.section import SectionService

router = APIRouter(
    prefix="/portfolios/{portfolio_id}/sections",
    tags=["sections"],
    responses=ERROR_RESPONSES,
    route_class=TransactionRoute,
)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=SectionOut,
    summary="Add a section",
    description=(
        "The body is empty — a section has no type to choose. The new one "
        "files under the tab the page already uses, so it is reachable the "
        "moment it exists."
    ),
)
async def add_section(
    payload: SectionCreate, portfolio: EditablePortfolio, session: SessionDep
) -> SectionOut:
    section = await SectionService(session).add(portfolio)
    return section_out(section)


@router.patch("/{section_id}", response_model=SectionOut, summary="Edit a section")
async def update_section(
    section_id: uuid.UUID,
    payload: SectionPatch,
    portfolio: EditablePortfolio,
    session: SessionDep,
) -> SectionOut:
    section = await SectionService(session).update(portfolio, section_id, payload)
    return section_out(section)


@router.delete(
    "/{section_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a section"
)
async def delete_section(
    section_id: uuid.UUID, portfolio: EditablePortfolio, session: SessionDep
) -> None:
    await SectionService(session).delete(portfolio, section_id)


# Returns the whole portfolio: a reorder is only meaningful as the new order,
# and the client would otherwise have to re-fetch to learn it.
@router.post("/{section_id}/move", response_model=PortfolioOut, summary="Move one place")
async def move_section(
    section_id: uuid.UUID,
    payload: SectionMove,
    portfolio: EditablePortfolio,
    session: SessionDep,
) -> PortfolioOut:
    await SectionService(session).move(portfolio, section_id, payload.delta)
    return PortfolioService(session).to_out(portfolio)


@router.put("/order", response_model=PortfolioOut, summary="Set the whole order")
async def reorder_sections(
    payload: SectionOrder, portfolio: EditablePortfolio, session: SessionDep
) -> PortfolioOut:
    await SectionService(session).reorder(portfolio, payload)
    return PortfolioService(session).to_out(portfolio)
