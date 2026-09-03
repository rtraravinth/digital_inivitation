"""The /account surface.

Some of this is stored state that enforces nothing, because it describes a
service this build does not have — billing, DNS, outbound mail. Those
endpoints say so in their docstrings, and the UI says so on screen. The rest
is real.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, SessionDep
from app.schemas.account import (
    AccountOut,
    DomainPatch,
    NotificationsPatch,
    PlanPatch,
    PrivacyPatch,
    ProfilePatch,
    SecurityPatch,
)
from app.schemas.common import ERROR_RESPONSES
from app.services.account import AccountService
from app.services.storage import get_storage

router = APIRouter(tags=["account"], responses=ERROR_RESPONSES)


@router.get("/account", response_model=AccountOut, summary="Everything on /account")
async def read_account(session: SessionDep, user: CurrentUser) -> AccountOut:
    return await AccountService(session).get(user)


@router.patch("/account/profile", response_model=AccountOut, summary="Update your profile")
async def update_profile(
    payload: ProfilePatch, session: SessionDep, user: CurrentUser
) -> AccountOut:
    return await AccountService(session).update_profile(user, payload)


@router.patch("/account/security", response_model=AccountOut, summary="Contact details")
async def update_security(
    payload: SecurityPatch, session: SessionDep, user: CurrentUser
) -> AccountOut:
    return await AccountService(session).update_security(user, payload)


@router.patch(
    "/account/plan",
    response_model=AccountOut,
    summary="Change plan (stored only)",
    description=(
        "Records the chosen plan. It charges nothing and unlocks nothing — "
        "there is no payment processor in this build."
    ),
)
async def set_plan(payload: PlanPatch, session: SessionDep, user: CurrentUser) -> AccountOut:
    return await AccountService(session).set_plan(user, payload)


@router.patch(
    "/account/domain",
    response_model=AccountOut,
    summary="Set a custom domain (stored only)",
    description=(
        "Records the domain. Nothing serves it — that needs DNS and a host "
        "this build does not configure."
    ),
)
async def set_domain(payload: DomainPatch, session: SessionDep, user: CurrentUser) -> AccountOut:
    return await AccountService(session).set_domain(user, payload)


@router.patch(
    "/account/notifications",
    response_model=AccountOut,
    summary="Notification preferences (stored only)",
    description="Records the preferences. Nothing sends mail in this build.",
)
async def update_notifications(
    payload: NotificationsPatch, session: SessionDep, user: CurrentUser
) -> AccountOut:
    return await AccountService(session).update_notifications(user, payload)


@router.patch(
    "/account/privacy",
    response_model=AccountOut,
    summary="Privacy switches",
    description=(
        "All four are enforced by the published-page endpoint: indexing, "
        "whether contact links are serialised at all, whether visits are "
        "counted, and whether the badge shows."
    ),
)
async def update_privacy(
    payload: PrivacyPatch, session: SessionDep, user: CurrentUser
) -> AccountOut:
    return await AccountService(session).update_privacy(user, payload)


@router.delete(
    "/account",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete the account and everything in it",
)
async def delete_account(session: SessionDep, user: CurrentUser) -> None:
    keys = await AccountService(session).delete_account(user)

    storage = get_storage()
    for key in keys:
        storage.delete(key)
