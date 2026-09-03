"""Registration, sign-in, session lifecycle, and the second factor."""

from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import pyotp
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import Conflict, NotFound, Unauthenticated, ValidationFailed
from app.core.security import (
    burn_dummy_verification,
    create_access_token,
    create_challenge_token,
    decode_challenge_token,
    hash_password,
    hash_token,
    new_refresh_token,
    verify_password,
)
from app.models import AccountProfile, AccountSettings, AuthSession, RecoveryCode, User

logger = logging.getLogger("app.auth")

#: The alphabet from ``generateRecoveryCodes()`` in src/lib/account.ts —
#: no I, O, 0 or 1, so a code read off a screen cannot be mistyped.
RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
RECOVERY_CODE_COUNT = 10


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

    # ── registration ────────────────────────────────────────────────────

    async def register(
        self, email: str, password: str, name: str, device: DeviceInfo
    ) -> tuple[User, IssuedTokens]:
        existing = await self.session.scalar(select(User).where(User.email == email))
        if existing is not None:
            raise Conflict(
                "An account already uses that email address.",
                code="email_taken",
                details={"email": email},
            )

        user = User(email=email, password_hash=hash_password(password), is_active=True)
        user.profile = AccountProfile(name=name, tags=[], links=[])
        user.settings = AccountSettings(password_changed_at=datetime.now(UTC))

        self.session.add(user)
        await self.session.flush()

        tokens = await self._open_session(user, device)
        return user, tokens

    # ── sign in ─────────────────────────────────────────────────────────

    async def authenticate(self, email: str, password: str) -> User:
        user = await self.session.scalar(select(User).where(User.email == email))

        if user is None:
            # Spend the same time as a real verification so the response
            # cannot be used to discover which addresses have accounts.
            burn_dummy_verification()
            raise self._invalid_credentials()

        if not user.is_active or not verify_password(password, user.password_hash):
            raise self._invalid_credentials()

        return user

    async def login(
        self, email: str, password: str, device: DeviceInfo
    ) -> tuple[User, IssuedTokens] | tuple[User, str]:
        """Returns tokens, or a challenge string when two-step is on."""
        user = await self.authenticate(email, password)

        if user.settings.two_step_enabled:
            # No session exists until the second factor is satisfied.
            return user, create_challenge_token(str(user.id))

        return user, await self._open_session(user, device)

    async def complete_two_step(
        self, challenge: str, code: str, device: DeviceInfo
    ) -> tuple[User, IssuedTokens]:
        user_id = decode_challenge_token(challenge)
        user = await self.session.get(User, user_id)
        if user is None or not user.is_active:
            raise self._invalid_credentials()

        if not await self.verify_second_factor(user, code):
            raise ValidationFailed(
                "That code is not valid.", code="invalid_two_step_code"
            )

        return user, await self._open_session(user, device)

    def _invalid_credentials(self) -> Unauthenticated:
        # One message for a wrong password and an unknown address alike.
        return Unauthenticated(
            "Those details do not match an account.", code="invalid_credentials"
        )

    # ── sessions ────────────────────────────────────────────────────────

    async def _open_session(self, user: User, device: DeviceInfo) -> IssuedTokens:
        plaintext, hashed = new_refresh_token()
        now = datetime.now(UTC)

        auth_session = AuthSession(
            user_id=user.id,
            refresh_token_hash=hashed,
            device=device.device,
            user_agent=device.user_agent,
            ip=device.ip,
            last_seen_at=now,
            expires_at=now + timedelta(days=self.settings.refresh_token_ttl_days),
        )
        self.session.add(auth_session)
        await self.session.flush()

        return IssuedTokens(
            access_token=create_access_token(str(user.id), session_id=str(auth_session.id)),
            refresh_token=plaintext,
            expires_in=self.settings.access_token_ttl_minutes * 60,
            session=auth_session,
        )

    async def refresh(self, plaintext: str, device: DeviceInfo) -> tuple[User, IssuedTokens]:
        """Rotate a refresh token.

        The old token is revoked as the new one is issued. Presenting a token
        that is already revoked means it leaked — every session for that user
        is dropped rather than guessing which holder is the legitimate one.
        """
        hashed = hash_token(plaintext)
        auth_session = await self.session.scalar(
            select(AuthSession).where(AuthSession.refresh_token_hash == hashed)
        )

        if auth_session is None:
            raise Unauthenticated(
                "Please sign in again.", code="invalid_refresh_token"
            )

        if auth_session.revoked_at is not None:
            logger.warning(
                "refresh token reuse detected",
                extra={"user_id": str(auth_session.user_id)},
            )
            await self._revoke_all(auth_session.user_id)
            raise Unauthenticated("Please sign in again.", code="invalid_refresh_token")

        if auth_session.expires_at <= datetime.now(UTC):
            raise Unauthenticated("Please sign in again.", code="invalid_refresh_token")

        user = await self.session.get(User, auth_session.user_id)
        if user is None or not user.is_active:
            raise Unauthenticated("Please sign in again.", code="invalid_refresh_token")

        auth_session.revoked_at = datetime.now(UTC)
        return user, await self._open_session(user, device)

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
            select(AuthSession).where(
                AuthSession.id == session_id, AuthSession.user_id == user.id
            )
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

    async def _revoke_all(self, user_id) -> None:
        await self.session.execute(
            update(AuthSession)
            .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )

    # ── password ────────────────────────────────────────────────────────

    async def change_password(
        self, user: User, current: str, new: str, keep_session_id: str
    ) -> None:
        if not verify_password(current, user.password_hash):
            raise Unauthenticated(
                "That is not your current password.", code="invalid_credentials"
            )

        user.password_hash = hash_password(new)
        user.settings.password_changed_at = datetime.now(UTC)
        # A password change that leaves other devices signed in is not a
        # password change.
        await self.revoke_other_sessions(user, keep_session_id)

    # ── two-step ────────────────────────────────────────────────────────

    async def begin_two_step(self, user: User) -> tuple[str, str]:
        if user.settings.two_step_enabled:
            raise Conflict("Two-step is already on.", code="two_step_already_enabled")

        secret = pyotp.random_base32()
        # Held aside until a code proves the authenticator app has it. A
        # secret written straight to two_step_secret could lock the user out.
        user.settings.two_step_pending_secret = secret

        uri = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name="FACET")
        return secret, uri

    async def confirm_two_step(self, user: User, code: str) -> None:
        pending = user.settings.two_step_pending_secret
        if not pending:
            raise Conflict("Start two-step setup first.", code="two_step_not_started")

        if not pyotp.TOTP(pending).verify(code, valid_window=1):
            raise ValidationFailed("That code is not valid.", code="invalid_two_step_code")

        user.settings.two_step_secret = pending
        user.settings.two_step_pending_secret = None
        user.settings.two_step_enabled = True

    async def disable_two_step(self, user: User, code: str) -> None:
        if not user.settings.two_step_enabled:
            raise Conflict("Two-step is not on.", code="two_step_not_enabled")

        if not await self.verify_second_factor(user, code):
            raise ValidationFailed("That code is not valid.", code="invalid_two_step_code")

        user.settings.two_step_enabled = False
        user.settings.two_step_secret = None
        user.settings.two_step_pending_secret = None
        await self._clear_recovery_codes(user)

    async def verify_second_factor(self, user: User, code: str) -> bool:
        """A TOTP code, or one unused recovery code."""
        secret = user.settings.two_step_secret
        candidate = code.strip().upper().replace(" ", "")

        if secret and candidate.isdigit() and pyotp.TOTP(secret).verify(code.strip(), valid_window=1):
            return True

        return await self._consume_recovery_code(user, candidate)

    # ── recovery codes ──────────────────────────────────────────────────

    async def issue_recovery_codes(self, user: User) -> list[str]:
        """Replace the set. Returned in plaintext once and never again."""
        await self._clear_recovery_codes(user)

        codes = [self._generate_recovery_code() for _ in range(RECOVERY_CODE_COUNT)]
        for code in codes:
            self.session.add(RecoveryCode(user_id=user.id, code_hash=hash_password(code)))
        await self.session.flush()
        return codes

    @staticmethod
    def _generate_recovery_code() -> str:
        body = "".join(secrets.choice(RECOVERY_ALPHABET) for _ in range(8))
        return f"{body[:4]}-{body[4:]}"

    async def _clear_recovery_codes(self, user: User) -> None:
        rows = await self.session.scalars(
            select(RecoveryCode).where(RecoveryCode.user_id == user.id)
        )
        for row in rows:
            await self.session.delete(row)
        await self.session.flush()

    async def _consume_recovery_code(self, user: User, candidate: str) -> bool:
        rows = await self.session.scalars(
            select(RecoveryCode).where(
                RecoveryCode.user_id == user.id, RecoveryCode.used_at.is_(None)
            )
        )
        for row in rows:
            if verify_password(candidate, row.code_hash):
                row.used_at = datetime.now(UTC)
                await self.session.flush()
                return True
        return False

    async def count_recovery_codes(self, user: User) -> int:
        rows = await self.session.scalars(
            select(RecoveryCode).where(
                RecoveryCode.user_id == user.id, RecoveryCode.used_at.is_(None)
            )
        )
        return len(list(rows))
