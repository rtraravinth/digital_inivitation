"""Aggregate figures for the owner of a page."""

from __future__ import annotations

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, SessionDep
from app.api.route import TransactionRoute
from app.schemas.analytics import SummaryOut
from app.schemas.common import ERROR_RESPONSES
from app.services.analytics import AnalyticsService

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    responses=ERROR_RESPONSES,
    route_class=TransactionRoute,
)


@router.get(
    "/summary",
    response_model=SummaryOut,
    summary="Views, clicks and sources",
    description=(
        "Counted from real events. When nothing has happened the result is "
        "empty — no figure here is ever estimated or generated."
    ),
)
async def summary(
    session: SessionDep,
    user: CurrentUser,
    days: int = Query(default=30, ge=1, le=3650, description="Window in days"),
) -> SummaryOut:
    return await AnalyticsService(session).summary(user, days)


@router.delete(
    "", status_code=status.HTTP_204_NO_CONTENT, summary="Delete all your analytics"
)
async def reset(session: SessionDep, user: CurrentUser) -> None:
    await AnalyticsService(session).reset(user)
