"""Verifying a Firebase ID token, and nothing else.

Firebase Authentication owns every credential: passwords, the Google and
GitHub grants, email links and phone codes. FACET never sees one. What it
receives is the ID token Firebase hands the browser after a sign-in — an
RS256 JWT — and this module decides whether to believe it.

It is checked here against Google's published keys with PyJWT rather than
through ``firebase-admin``: verification needs only the project id, so the
API holds no service-account secret and pulls in no Google SDK. The checks
are the ones Firebase documents for third-party verification:

* signed by one of the ``securetoken`` keys, algorithm RS256 only;
* ``aud`` is this project and ``iss`` is ``securetoken.google.com/<project>``;
* not expired, not issued in the future, and ``sub`` (the Firebase uid) set;
* ``auth_time`` in the past — and, beyond what Firebase asks, recent: an ID
  token lives an hour, and this one is about to be traded for a 30-day
  FACET session.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.errors import Unauthenticated

#: Google's signing keys for Firebase ID tokens, as a JWKS.
JWKS_URL = (
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
)

#: Seconds of clock difference tolerated between Google and this server.
LEEWAY_SECONDS = 60


@dataclass(frozen=True)
class FirebaseIdentity:
    """Who Firebase says signed in. Never carries a credential."""

    uid: str
    email: str | None
    email_verified: bool
    phone: str | None
    name: str
    #: ``password``, ``google.com``, ``github.com``, ``emailLink``, ``phone``…
    provider: str
    #: When the person actually signed in to Firebase. A FACET session keeps
    #: it across rotations, to compare with Firebase's ``validSince``.
    auth_time: datetime


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    # Keys are cached in-process; Google rotates them every few days and the
    # client refetches when a token names a key id it has not seen.
    return jwt.PyJWKClient(JWKS_URL, cache_keys=True, lifespan=6 * 60 * 60, timeout=10)


def _rejected() -> Unauthenticated:
    # One answer for every failure: which check failed is of use only to
    # someone forging tokens.
    return Unauthenticated(
        "That sign-in could not be confirmed. Please try again.", code="invalid_firebase_token"
    )


def claims_to_identity(claims: dict[str, Any], *, project_id: str, now: float) -> FirebaseIdentity:
    """Every check that does not need the signature. Split out to be tested."""
    max_age = get_settings().firebase_max_auth_age_seconds

    uid = claims.get("sub")
    if not isinstance(uid, str) or not uid or len(uid) > 128:
        raise _rejected()

    if claims.get("iss") != f"https://securetoken.google.com/{project_id}":
        raise _rejected()

    auth_time = claims.get("auth_time")
    if not isinstance(auth_time, int | float) or auth_time > now + LEEWAY_SECONDS:
        raise _rejected()
    if now - auth_time > max_age:
        raise Unauthenticated(
            "That sign-in is too old. Please sign in again.", code="firebase_sign_in_stale"
        )

    firebase = claims.get("firebase") if isinstance(claims.get("firebase"), dict) else {}
    provider = firebase.get("sign_in_provider")
    if not isinstance(provider, str) or provider == "anonymous" or provider == "custom":
        # Anonymous accounts have no identity to own a portfolio, and custom
        # tokens are minted by a server — never ours.
        raise _rejected()

    email = claims.get("email")
    email = email.strip().lower() if isinstance(email, str) and email.strip() else None
    phone = claims.get("phone_number")
    name = claims.get("name")

    return FirebaseIdentity(
        uid=uid,
        email=email,
        email_verified=claims.get("email_verified") is True,
        phone=phone if isinstance(phone, str) and phone else None,
        name=name.strip()[:200] if isinstance(name, str) else "",
        provider=provider,
        auth_time=datetime.fromtimestamp(auth_time, UTC),
    )


def _verify_sync(token: str) -> FirebaseIdentity:
    project_id = get_settings().firebase_project_id
    if not project_id:
        raise Unauthenticated(
            "Sign-in is not set up on this server.", code="firebase_not_configured"
        )

    try:
        key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
            leeway=LEEWAY_SECONDS,
            options={"require": ["exp", "iat", "aud", "iss", "sub", "auth_time"]},
        )
    except jwt.PyJWKClientConnectionError as exc:
        raise Unauthenticated(
            "Could not reach the sign-in service. Please try again.", code="firebase_unreachable"
        ) from exc
    except jwt.PyJWTError as exc:
        raise _rejected() from exc

    return claims_to_identity(claims, project_id=project_id, now=time.time())


async def verify_id_token(token: str) -> FirebaseIdentity:
    # PyJWKClient fetches with blocking urllib; keep it off the event loop.
    return await run_in_threadpool(_verify_sync, token)


async def get_firebase_verifier() -> Callable[[str], Any]:
    """The verifier a route uses. Tests override this dependency."""
    return verify_id_token


FirebaseVerifierDep = Annotated[Callable[[str], Any], Depends(get_firebase_verifier)]
