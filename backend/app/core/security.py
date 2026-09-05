"""Password hashing and tokens.

Two kinds of token, on purpose:

* **Access tokens** are JWTs. Short-lived, stateless, checked without a query.
* **Refresh tokens** are opaque random strings, stored as a SHA-256 hash on a
  row. They must be revocable — signing out a device has to actually stop it,
  and you cannot revoke a stateless JWT.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.errors import Unauthenticated

_hasher = PasswordHasher()

#: A real argon2 hash of a throwaway value. `login` verifies against this when
#: the email is unknown, so an unknown address and a wrong password take the
#: same time and the response cannot be used to enumerate accounts.
_DUMMY_HASH = _hasher.hash("dummy-password-for-constant-time-comparison")


def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """False for a wrong password *or* a malformed hash. Never raises."""
    try:
        return _hasher.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def burn_dummy_verification() -> None:
    """Spend the same time as a real check, for an email that does not exist."""
    verify_password("dummy-password-for-constant-time-comparison", _DUMMY_HASH)


def needs_rehash(hashed: str) -> bool:
    try:
        return _hasher.check_needs_rehash(hashed)
    except InvalidHashError:
        return True


class AccessClaims(BaseModel):
    sub: str
    sid: str
    exp: int


def _encode(payload: dict[str, Any]) -> str:
    settings = get_settings()
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode(token: str, *, expected_type: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise Unauthenticated("That session has expired.", code="token_expired") from exc
    except jwt.PyJWTError as exc:
        raise Unauthenticated("That token is not valid.", code="invalid_token") from exc

    if payload.get("typ") != expected_type:
        # An access token used as a login challenge, or the reverse.
        raise Unauthenticated("That token is not valid.", code="invalid_token")
    return payload


def create_access_token(subject: str, *, session_id: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    return _encode(
        {
            "sub": subject,
            "sid": session_id,
            "typ": "access",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=settings.access_token_ttl_minutes)).timestamp()),
        }
    )


def decode_access_token(token: str) -> AccessClaims:
    return AccessClaims.model_validate(_decode(token, expected_type="access"))


def create_challenge_token(subject: str) -> str:
    """Proves the password step passed, pending a second factor."""
    settings = get_settings()
    now = datetime.now(UTC)
    return _encode(
        {
            "sub": subject,
            "typ": "challenge",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=settings.challenge_ttl_seconds)).timestamp()),
        }
    )


def decode_challenge_token(token: str) -> str:
    payload = _decode(token, expected_type="challenge")
    subject = payload.get("sub")
    if not isinstance(subject, str):
        raise Unauthenticated("That token is not valid.", code="invalid_token")
    return subject


def hash_token(plaintext: str) -> str:
    """SHA-256, not argon2.

    A refresh token is 384 bits of entropy from a CSPRNG, so it needs no work
    factor — and it is verified by lookup, which argon2 cannot do.
    """
    return hashlib.sha256(plaintext.encode()).hexdigest()


def new_refresh_token() -> tuple[str, str]:
    plaintext = secrets.token_urlsafe(48)
    return plaintext, hash_token(plaintext)


TokenType = Literal["bearer"]
