"""Export and import — the tools that existed before there was a backend."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.api.route import TransactionRoute
from app.schemas.common import ERROR_RESPONSES
from app.schemas.transfer import ImportRequest, ImportResultOut
from app.services.transfer import TransferService

router = APIRouter(
    tags=["transfer"], responses=ERROR_RESPONSES, route_class=TransactionRoute
)


@router.get(
    "/export",
    summary="Every portfolio as JSON",
    description=(
        "The same array shape the localStorage build exported, so a file "
        "taken from it still imports here."
    ),
)
async def export_all(session: SessionDep, user: CurrentUser) -> list[dict[str, Any]]:
    return await TransferService(session).export(user)


@router.post("/import", response_model=ImportResultOut, summary="Load an export back in")
async def import_all(
    payload: ImportRequest, session: SessionDep, user: CurrentUser
) -> ImportResultOut:
    return await TransferService(session).import_(user, payload.portfolios, payload.mode)
