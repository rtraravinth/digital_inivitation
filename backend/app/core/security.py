"""FACET's own tokens.

No passwords: Firebase Authentication holds every credential and
``app.core.firebase`` verifies what it issues. What is left are the tokens
FACET mints once Firebase has said who someone is. Two kinds, on purpose:

* **Access tokens** are JWTs. Short-lived, stateless, checked without a query.
* **Refresh tokens** are opaque random strings, stored as a SHA-256 hash on a
  row. They must be revocable — signing out a device has to actually stop it,
  and you cannot revoke a stateless JWT.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.errors import Unauthenticated


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
        # An asset token used as an access token, or the reverse.
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


def create_asset_token(asset_id: str, *, ttl_minutes: int | None = None) -> str:
    """Signs one asset id, so its URL can be opened without a header.

    An ``<img src>`` cannot carry ``Authorization``, which is why the owner's
    own upload URL needs a signature in the query string instead. The token
    names a single asset: possession of one grants nothing else.
    """
    settings = get_settings()
    now = datetime.now(UTC)
    minutes = settings.asset_url_ttl_minutes if ttl_minutes is None else ttl_minutes
    return _encode(
        {
            "sub": asset_id,
            "typ": "asset",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=minutes)).timestamp()),
        }
    )


def decode_asset_token(token: str) -> str:
    """The asset id the token was signed for. Raises on anything else."""
    subject = _decode(token, expected_type="asset").get("sub")
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
