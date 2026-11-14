"""Sign in, sign out, and the devices an account is signed in on.

Firebase Authentication does the proving — passwords, Google, GitHub, email
links, phone codes, and any second factor. ``POST /auth/firebase`` trades the
ID token it issues for a FACET session: the same short-lived access token and
httpOnly refresh cookie as before, so everything after sign-in is unchanged.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Cookie, Response, status

from app.api.deps import (
    REFRESH_COOKIE,
    REFRESH_COOKIE_PATH,
    CallerDep,
    DeviceDep,
    SessionDep,
)
from app.api.route import TransactionRoute
from app.core.config import get_settings
from app.core.errors import Unauthenticated
from app.core.firebase import FirebaseVerifierDep
from app.core.firebase_accounts import AccountCheckerDep
from app.core.ratelimit import RefreshLimit, SignInLimit
from app.models import User
from app.schemas.auth import AuthOut, FirebaseSignInRequest, SessionOut, TokenOut, UserOut
from app.schemas.common import ERROR_RESPONSES
from app.services.auth import AuthService, IssuedTokens

router = APIRouter(
    prefix="/auth", tags=["auth"], responses=ERROR_RESPONSES, route_class=TransactionRoute
)


def _set_refresh_cookie(response: Response, token: str) -> None:
    """The refresh token leaves the server only as an httpOnly cookie.

    Never in a response body: a token in JSON is a token in localStorage, and
    a token in localStorage is readable by any script that gets injected.
    """
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        httponly=True,
        secure=settings.is_prod,
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
        max_age=settings.refresh_token_ttl_days * 24 * 60 * 60,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.profile.name if user.profile else "",
        handle=user.profile.handle if user.profile else None,
    )


def _auth_out(user: User, tokens: IssuedTokens) -> AuthOut:
    return AuthOut(
        user=_user_out(user),
        token=TokenOut(access_token=tokens.access_token, expires_in=tokens.expires_in),
    )


@router.post("/firebase", response_model=AuthOut, summary="Sign in with a Firebase ID token")
async def firebase_sign_in(
    _: SignInLimit,
    payload: FirebaseSignInRequest,
    response: Response,
    session: SessionDep,
    device: DeviceDep,
    verify: FirebaseVerifierDep,
    accounts: AccountCheckerDep,
) -> AuthOut:
    identity = await verify(payload.id_token)
    user, tokens = await AuthService(session).sign_in(
        identity, device, accounts, name=payload.name, handle=payload.handle
    )
    _set_refresh_cookie(response, tokens.refresh_token)
    return _auth_out(user, tokens)


@router.post("/refresh", response_model=AuthOut, summary="Exchange the refresh cookie")
async def refresh(
    _: RefreshLimit,
    response: Response,
    session: SessionDep,
    device: DeviceDep,
    accounts: AccountCheckerDep,
    facet_refresh: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
) -> AuthOut:
    if not facet_refresh:
        raise Unauthenticated("Please sign in again.", code="invalid_refresh_token")

    service = AuthService(session)
    user, tokens = await service.refresh(facet_refresh, device, accounts)
    _set_refresh_cookie(response, tokens.refresh_token)
    return _auth_out(user, tokens)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out this device")
async def logout(
    response: Response,
    session: SessionDep,
    caller: CallerDep,
    facet_refresh: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
) -> None:
    await AuthService(session).logout(facet_refresh, caller.session_id)
    _clear_refresh_cookie(response)


@router.get("/sessions", response_model=list[SessionOut], summary="Devices signed in")
async def list_sessions(session: SessionDep, caller: CallerDep) -> list[SessionOut]:
    rows = await AuthService(session).list_sessions(caller.user, caller.session_id)
    return [
        SessionOut(
            id=row.id,
            device=row.device,
            place=row.ip or "Unknown location",
            when=row.last_seen_at or row.created_at,
            current=str(row.id) == caller.session_id,
        )
        for row in rows
    ]


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign out one device",
)
async def revoke_session(session_id: uuid.UUID, session: SessionDep, caller: CallerDep) -> None:
    await AuthService(session).revoke_session(caller.user, str(session_id))


@router.delete("/sessions", summary="Sign out every other device")
async def revoke_other_sessions(session: SessionDep, caller: CallerDep) -> dict[str, int]:
    revoked = await AuthService(session).revoke_other_sessions(caller.user, caller.session_id)
    return {"revoked": revoked}
