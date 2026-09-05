"""Request dependencies.

The one place ownership is decided. A router asks for the thing it is about
and either gets the caller's row or a 404 — there is no path where a router
authorizes for itself and no path where it can forget to.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound, Unauthenticated
from app.core.security import decode_access_token
from app.db.session import get_session
from app.models import AuthSession, Portfolio, User
from app.services.auth import DeviceInfo

SessionDep = Annotated[AsyncSession, Depends(get_session)]

#: Set by the auth router; read here to revoke on logout and refresh.
REFRESH_COOKIE = "facet_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"


@dataclass(frozen=True)
class Caller:
    """The authenticated user plus the session the request arrived on."""

    user: User
    session_id: str


def _bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise Unauthenticated("You need to sign in to do that.")
    return token.strip()


async def get_caller(request: Request, session: SessionDep) -> Caller:
    claims = decode_access_token(_bearer_token(request))

    try:
        session_uuid = uuid.UUID(claims.sid)
    except ValueError as exc:
        raise Unauthenticated("That token is not valid.", code="invalid_token") from exc

    auth_session = await session.get(AuthSession, session_uuid)
    # A revoked session must stop its access token immediately — otherwise
    # "sign out this device" would do nothing for up to the token's lifetime.
    if auth_session is None or not auth_session.is_active:
        raise Unauthenticated("Please sign in again.", code="session_revoked")

    user = await session.get(User, auth_session.user_id)
    if user is None or not user.is_active:
        raise Unauthenticated("Please sign in again.", code="session_revoked")

    return Caller(user=user, session_id=str(auth_session.id))


async def get_current_user(caller: Annotated[Caller, Depends(get_caller)]) -> User:
    return caller.user


CallerDep = Annotated[Caller, Depends(get_caller)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def get_device_info(request: Request) -> DeviceInfo:
    """A human label for the device, from what the browser volunteers."""
    user_agent = request.headers.get("User-Agent")
    return DeviceInfo(
        device=describe_device(user_agent),
        user_agent=user_agent[:400] if user_agent else None,
        ip=request.client.host if request.client else None,
    )


DeviceDep = Annotated[DeviceInfo, Depends(get_device_info)]


def describe_device(user_agent: str | None) -> str:
    """Good enough to recognise your own laptop in a list. Not fingerprinting."""
    if not user_agent:
        return "Unknown device"

    agent = user_agent.lower()
    if "iphone" in agent:
        platform = "iPhone"
    elif "ipad" in agent:
        platform = "iPad"
    elif "android" in agent:
        platform = "Android"
    elif "mac os" in agent or "macintosh" in agent:
        platform = "Mac"
    elif "windows" in agent:
        platform = "Windows"
    elif "linux" in agent:
        platform = "Linux"
    else:
        platform = "Unknown device"

    if "edg/" in agent:
        browser = "Edge"
    elif "chrome/" in agent and "chromium" not in agent:
        browser = "Chrome"
    elif "firefox/" in agent:
        browser = "Firefox"
    elif "safari/" in agent:
        browser = "Safari"
    else:
        return platform

    return f"{browser} on {platform}"


async def get_owned_portfolio(
    portfolio_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> Portfolio:
    portfolio = await session.scalar(
        select(Portfolio).where(Portfolio.id == portfolio_id, Portfolio.user_id == user.id)
    )
    if portfolio is None:
        # Missing and someone else's are the same answer on purpose.
        raise NotFound("That portfolio does not exist.", code="portfolio_not_found")
    return portfolio


OwnedPortfolio = Annotated[Portfolio, Depends(get_owned_portfolio)]


async def get_editable_portfolio(portfolio: OwnedPortfolio) -> Portfolio:
    """The caller's portfolio, refused while it is live.

    A published page is what a visitor is reading right now, so it is frozen:
    every write to it answers 409 until the owner unpublishes. Publish and
    unpublish ask for ``OwnedPortfolio`` instead, or there would be no way
    back out.
    """
    if portfolio.status == "live":
        raise Conflict(
            "Unpublish this page before you edit or delete it.",
            code="portfolio_published",
        )
    return portfolio


EditablePortfolio = Annotated[Portfolio, Depends(get_editable_portfolio)]
