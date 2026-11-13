"""Signing in through Firebase, and the FACET session that follows."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import NotFound, PermissionDenied, Unauthenticated, ValidationFailed
from app.core.firebase import FirebaseIdentity
from app.core.firebase_accounts import AccountChecker
from app.core.security import create_access_token, hash_token, new_refresh_token
from app.models import AccountProfile, AccountSettings, AuthSession, User
from app.services.account import assert_handle_available

logger = logging.getLogger("app.auth")


@dataclass(frozen=True)
class DeviceInfo:
    device: str
    user_agent: str | None
    ip: str | None


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    refresh_token: str
    expires_in: int
    session: AuthSession


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.settings = get_settings()

    # ── sign in ─────────────────────────────────────────────────────────

    async def sign_in(
        self,
        identity: FirebaseIdentity,
        device: DeviceInfo,
        accounts: AccountChecker,
        *,
        name: str | None = None,
        handle: str | None = None,
    ) -> tuple[User, IssuedTokens]:
        """Open a session for whoever Firebase has verified.

        Three cases, in this order:

        1. The uid is already an account's — sign it in.
        2. The email matches an account made before Firebase (or by the CLI).
           It is linked, but **only if Firebase has verified the address**:
           otherwise anyone could register ``someone@example.com`` with a
           password in Firebase and walk into that person's portfolios.
        3. Nobody yet — create the account. That needs a handle, because the
           handle is the front of every address the account publishes; without
           one this answers 422 ``handle_required`` and the sign-in page asks.
        """
        # Firebase's verdict first: a valid-looking ID token from before a
        # password reset or a revocation, or for a disabled user, opens nothing.
        state = await accounts.lookup(identity.uid)
        if state is not None and not state.allows(identity.auth_time):
            raise Unauthenticated(
                "That sign-in is no longer valid. Please sign in again.",
                code="firebase_session_revoked",
            )

        user = await self.session.scalar(select(User).where(User.firebase_uid == identity.uid))

        if user is None and identity.email is not None:
            user = await self._link_by_email(identity)

        if user is None:
            user = await self._create(identity, name, handle)

        if not user.is_active:
            raise Unauthenticated("This account is closed.", code="account_inactive")

        # An address changed in Firebase since the last sign-in.
        await self._follow_email(user, identity)

        user.settings.sign_in_provider = identity.provider[:32]
        if identity.provider == "google.com":
            user.settings.google_linked = True

        return user, await self._open_session(user, device, signed_in_at=identity.auth_time)

    async def _link_by_email(self, identity: FirebaseIdentity) -> User | None:
        user = await self.session.scalar(select(User).where(User.email == identity.email))
        if user is None:
            return None

        if not identity.email_verified:
            raise PermissionDenied(
                "Verify your email address first — check your inbox for the link.",
                code="email_unverified",
            )

        if user.firebase_uid is not None:
            # Firebase keeps one account per address, so a second uid for the
            # same verified address means the first Firebase account was
            # deleted. Proving the mailbox is what recovers an account anyway.
            logger.warning("firebase uid replaced for an account", extra={"user_id": str(user.id)})

        user.firebase_uid = identity.uid
        return user

    async def _create(
        self, identity: FirebaseIdentity, name: str | None, handle: str | None
    ) -> User:
        if identity.email is not None and not identity.email_verified:
            raise PermissionDenied(
                "Verify your email address first — check your inbox for the link.",
                code="email_unverified",
            )

        if not handle:
            raise ValidationFailed(
                "Pick the address your pages will live at.",
                code="handle_required",
                details={"name": identity.name},
            )

        # Before the user row, so a taken handle does not leave a half-made
        # account behind — and checked here rather than trusted to the unique
        # index, which cannot tell "taken" from "reserved".
        await assert_handle_available(self.session, handle)

        user = User(email=identity.email, firebase_uid=identity.uid, is_active=True)
        user.profile = AccountProfile(
            name=(name or identity.name or "").strip()[:200], handle=handle, tags=[], links=[]
        )
        user.settings = AccountSettings()

        self.session.add(user)
        await self.session.flush()
        return user

    # ── sessions ────────────────────────────────────────────────────────

    async def _open_session(
        self, user: User, device: DeviceInfo, *, signed_in_at: datetime
    ) -> IssuedTokens:
        plaintext, hashed = new_refresh_token()
        now = datetime.now(UTC)

        auth_session = AuthSession(
            user_id=user.id,
            refresh_token_hash=hashed,
            device=device.device,
            user_agent=device.user_agent,
            ip=device.ip,
            last_seen_at=now,
            # Sliding: every refresh pushes this out, so an account in use is
            # never signed out on a clock — only after this many idle days,
            # or when Firebase revokes it (see refresh).
            expires_at=now + timedelta(days=self.settings.refresh_token_ttl_days),
            signed_in_at=signed_in_at,
        )
        self.session.add(auth_session)
        await self.session.flush()

        return IssuedTokens(
            access_token=create_access_token(str(user.id), session_id=str(auth_session.id)),
            refresh_token=plaintext,
            expires_in=self.settings.access_token_ttl_minutes * 60,
            session=auth_session,
        )

    async def refresh(
        self, plaintext: str, device: DeviceInfo, accounts: AccountChecker
    ) -> tuple[User, IssuedTokens]:
        """Rotate a refresh token — if Firebase still vouches for the account.

        The old token is revoked as the new one is issued. Presenting a token
        that is already revoked means it leaked — every session for that user
        is dropped rather than guessing which holder is the legitimate one.

        Firebase is asked first, so its decisions reach FACET within one
        access-token lifetime: a deleted or disabled user loses every session,
        and a password reset or admin revocation ends every session signed in
        before it — exactly the sessions Firebase itself would end.
        """
        hashed = hash_token(plaintext)
        auth_session = await self.session.scalar(
            select(AuthSession).where(AuthSession.refresh_token_hash == hashed)
        )

        if auth_session is None:
            raise Unauthenticated("Please sign in again.", code="invalid_refresh_token")

        if auth_session.revoked_at is not None:
            logger.warning(
                "refresh token reuse detected",
                extra={"user_id": str(auth_session.user_id)},
            )
            await self._revoke_all(auth_session.user_id)
            raise Unauthenticated(
                "Please sign in again.", code="invalid_refresh_token", keep_writes=True
            )

        if auth_session.expires_at <= datetime.now(UTC):
            raise Unauthenticated("Please sign in again.", code="invalid_refresh_token")

        user = await self.session.get(User, auth_session.user_id)
        if user is None or not user.is_active:
            raise Unauthenticated("Please sign in again.", code="invalid_refresh_token")

        if user.firebase_uid is not None:
            state = await accounts.lookup(user.firebase_uid)
            if state is not None and (not state.exists or state.disabled):
                await self._revoke_all(user.id)
                raise Unauthenticated(
                    "This account has been turned off.", code="account_disabled", keep_writes=True
                )
            if state is not None:
                await self._follow_email(user, state)
            if state is not None and not state.allows(auth_session.signed_in_at):
                # Every session from before the reset, not just this one.
                await self._revoke_signed_in_before(user.id, state.valid_since)
                raise Unauthenticated(
                    "Your sign-in changed elsewhere. Please sign in again.",
                    code="firebase_session_revoked",
                    keep_writes=True,
                )

        auth_session.revoked_at = datetime.now(UTC)
        return user, await self._open_session(user, device, signed_in_at=auth_session.signed_in_at)

    async def logout(self, plaintext: str | None, session_id: str | None) -> None:
        """Revoke by refresh token if we have one, else by access-token sid."""
        target: AuthSession | None = None

        if plaintext:
            target = await self.session.scalar(
                select(AuthSession).where(AuthSession.refresh_token_hash == hash_token(plaintext))
            )
        if target is None and session_id:
            target = await self.session.get(AuthSession, session_id)

        if target is not None and target.revoked_at is None:
            target.revoked_at = datetime.now(UTC)

    async def list_sessions(self, user: User, current_session_id: str) -> list[AuthSession]:
        rows = await self.session.scalars(
            select(AuthSession)
            .where(
                AuthSession.user_id == user.id,
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > datetime.now(UTC),
            )
            .order_by(AuthSession.created_at.desc())
        )
        sessions = list(rows)
        # Sort the caller's own device to the top: it is the row they are
        # looking for when they came here to check.
        sessions.sort(key=lambda s: str(s.id) != current_session_id)
        return sessions

    async def revoke_session(self, user: User, session_id: str) -> None:
        target = await self.session.scalar(
            select(AuthSession).where(AuthSession.id == session_id, AuthSession.user_id == user.id)
        )
        # Another user's session id is "not found", never "forbidden" — a 403
        # would confirm the id exists.
        if target is None or target.revoked_at is not None:
            raise NotFound("That device is not signed in.", code="session_not_found")
        target.revoked_at = datetime.now(UTC)

    async def revoke_other_sessions(self, user: User, keep_session_id: str) -> int:
        result = await self.session.execute(
            update(AuthSession)
            .where(
                AuthSession.user_id == user.id,
                AuthSession.id != keep_session_id,
                AuthSession.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(UTC))
        )
        return int(result.rowcount or 0)

    async def _follow_email(self, user: User, state) -> None:
        """Copy an address changed in Firebase, once Firebase has verified it.

        Only a verified address, and only one no other account holds: the
        email is how an account made before Firebase is claimed, so it must
        never point at somebody else's.
        """
        if not state.email or not state.email_verified or state.email == user.email:
            return
        taken = await self.session.scalar(
            select(User.id).where(User.email == state.email, User.id != user.id)
        )
        if taken is None:
            user.email = state.email

    async def _revoke_signed_in_before(self, user_id, moment: datetime | None) -> None:
        if moment is None:
            return
        await self.session.execute(
            update(AuthSession)
            .where(
                AuthSession.user_id == user_id,
                AuthSession.revoked_at.is_(None),
                AuthSession.signed_in_at < moment,
            )
            .values(revoked_at=datetime.now(UTC))
        )

    async def _revoke_all(self, user_id) -> None:
        await self.session.execute(
            update(AuthSession)
            .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )
