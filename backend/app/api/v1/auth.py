"""Sign in, sign out, and everything that guards an account."""

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
from app.models import User
from app.schemas.auth import (
    AuthOut,
    ChangePasswordRequest,
    LoginRequest,
    RecoveryCodesOut,
    RegisterRequest,
    SessionOut,
    TokenOut,
    TwoStepCodeRequest,
    TwoStepLoginRequest,
    TwoStepRequiredOut,
    TwoStepSetupOut,
    UserOut,
)
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
        two_step=user.settings.two_step_enabled if user.settings else False,
    )


def _auth_out(user: User, tokens: IssuedTokens) -> AuthOut:
    return AuthOut(
        user=_user_out(user),
        token=TokenOut(access_token=tokens.access_token, expires_in=tokens.expires_in),
    )


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=AuthOut,
    summary="Create an account",
)
async def register(
    payload: RegisterRequest, response: Response, session: SessionDep, device: DeviceDep
) -> AuthOut:
    service = AuthService(session)
    user, tokens = await service.register(
        payload.email, payload.password, payload.name, device
    )
    _set_refresh_cookie(response, tokens.refresh_token)
    return _auth_out(user, tokens)


@router.post(
    "/login",
    response_model=AuthOut | TwoStepRequiredOut,
    summary="Sign in",
    responses={
        202: {"model": TwoStepRequiredOut, "description": "A second factor is required"}
    },
)
async def login(
    payload: LoginRequest, response: Response, session: SessionDep, device: DeviceDep
):
    service = AuthService(session)
    user, result = await service.login(payload.email, payload.password, device)

    if isinstance(result, str):
        # Password accepted, but no session exists until the code is right.
        response.status_code = status.HTTP_202_ACCEPTED
        return TwoStepRequiredOut(challenge=result)

    _set_refresh_cookie(response, result.refresh_token)
    return _auth_out(user, result)


@router.post("/login/two-step", response_model=AuthOut, summary="Finish signing in")
async def login_two_step(
    payload: TwoStepLoginRequest, response: Response, session: SessionDep, device: DeviceDep
) -> AuthOut:
    service = AuthService(session)
    user, tokens = await service.complete_two_step(payload.challenge, payload.code, device)
    _set_refresh_cookie(response, tokens.refresh_token)
    return _auth_out(user, tokens)


@router.post("/refresh", response_model=AuthOut, summary="Exchange the refresh cookie")
async def refresh(
    response: Response,
    session: SessionDep,
    device: DeviceDep,
    facet_refresh: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
) -> AuthOut:
    if not facet_refresh:
        raise Unauthenticated("Please sign in again.", code="invalid_refresh_token")

    service = AuthService(session)
    user, tokens = await service.refresh(facet_refresh, device)
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


@router.post(
    "/password", status_code=status.HTTP_204_NO_CONTENT, summary="Change your password"
)
async def change_password(
    payload: ChangePasswordRequest, session: SessionDep, caller: CallerDep
) -> None:
    await AuthService(session).change_password(
        caller.user, payload.current_password, payload.new_password, caller.session_id
    )


@router.post("/two-step/enable", response_model=TwoStepSetupOut, summary="Start two-step setup")
async def begin_two_step(session: SessionDep, caller: CallerDep) -> TwoStepSetupOut:
    secret, uri = await AuthService(session).begin_two_step(caller.user)
    return TwoStepSetupOut(secret=secret, otpauth_uri=uri)


@router.post(
    "/two-step/verify",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Confirm two-step with a code",
)
async def confirm_two_step(
    payload: TwoStepCodeRequest, session: SessionDep, caller: CallerDep
) -> None:
    await AuthService(session).confirm_two_step(caller.user, payload.code)


@router.post(
    "/two-step/disable", status_code=status.HTTP_204_NO_CONTENT, summary="Turn two-step off"
)
async def disable_two_step(
    payload: TwoStepCodeRequest, session: SessionDep, caller: CallerDep
) -> None:
    await AuthService(session).disable_two_step(caller.user, payload.code)


@router.post(
    "/recovery-codes",
    response_model=RecoveryCodesOut,
    summary="Issue ten single-use recovery codes",
)
async def issue_recovery_codes(session: SessionDep, caller: CallerDep) -> RecoveryCodesOut:
    codes = await AuthService(session).issue_recovery_codes(caller.user)
    # The only time these are readable. Only hashes are stored.
    return RecoveryCodesOut(codes=codes)
