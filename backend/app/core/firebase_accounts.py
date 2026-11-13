"""Asking Firebase whether an account may still be signed in.

FACET keeps its own sessions, so on its own it would not notice what Firebase
decides later: a user deleted or disabled in the console, a password reset, a
changed email, an admin revoking every token. Firebase records each of those
the same way — the user is gone, ``disabled`` is set, or ``validSince`` moves
past the sign-in — and this module reads that record so FACET's sessions end
when Firebase's do. ``AuthService.refresh`` asks on every refresh, which is at
most once an hour per device (the access token's lifetime).

Reading another user's record is an admin call, so it needs the project's
service account (``FACET_FIREBASE_SERVICE_ACCOUNT``). It is used here only to
mint a short-lived Google OAuth token for the Identity Toolkit
``accounts:lookup`` endpoint — signed with PyJWT, so no Google SDK is added.
Without it the check is skipped and a warning is logged once: sessions still
work, they just do not hear about Firebase-side changes.
"""

from __future__ import annotations

import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Protocol

import jwt
from fastapi import Depends
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.errors import ServiceUnavailable

logger = logging.getLogger("app.firebase")

TOKEN_URL = "https://oauth2.googleapis.com/token"
LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/projects/{project}/accounts:lookup"
DELETE_URL = "https://identitytoolkit.googleapis.com/v1/projects/{project}/accounts:delete"
SCOPE = "https://www.googleapis.com/auth/identitytoolkit"
TIMEOUT_SECONDS = 10


@dataclass(frozen=True)
class AccountState:
    """What Firebase says about one uid right now."""

    exists: bool
    disabled: bool = False
    #: Sessions that signed in before this are revoked: Firebase moves it on
    #: a password change or reset, an email change, or an admin revocation.
    valid_since: datetime | None = None
    #: The address Firebase has now, lowercased, and whether it is verified —
    #: so an email changed in Firebase reaches FACET's ``users.email``.
    email: str | None = None
    email_verified: bool = False

    def allows(self, signed_in_at: datetime) -> bool:
        if not self.exists or self.disabled:
            return False
        # Whole seconds on both sides: Firebase stores validSince in seconds,
        # and a sign-in in the same second as a reset is the new one.
        return self.valid_since is None or int(signed_in_at.timestamp()) >= int(
            self.valid_since.timestamp()
        )


class AccountChecker(Protocol):
    async def lookup(self, uid: str) -> AccountState | None:
        """The account's state, or None when Firebase could not be asked."""

    async def delete(self, uid: str) -> None:
        """Delete the Firebase user. Raises when Firebase could not be told."""


class FirebaseAccounts:
    """Looks accounts up through the Identity Toolkit admin API."""

    def __init__(self, service_account: dict, project_id: str) -> None:
        self._account = service_account
        self._project = project_id
        self._token: str | None = None
        self._token_expires = 0.0
        self._lock = threading.Lock()

    def _access_token(self) -> str:
        """A Google OAuth token from the service account, cached until near expiry."""
        with self._lock:
            if self._token and time.time() < self._token_expires - 60:
                return self._token

            now = int(time.time())
            assertion = jwt.encode(
                {
                    "iss": self._account["client_email"],
                    "scope": SCOPE,
                    "aud": TOKEN_URL,
                    "iat": now,
                    "exp": now + 3600,
                },
                self._account["private_key"],
                algorithm="RS256",
                headers={"kid": self._account.get("private_key_id", "")},
            )
            body = urllib.parse.urlencode(
                {
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": assertion,
                }
            ).encode()
            request = urllib.request.Request(TOKEN_URL, data=body, method="POST")
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                payload = json.load(response)

            self._token = payload["access_token"]
            self._token_expires = time.time() + int(payload.get("expires_in", 3600))
            return self._token

    def _post(self, url: str, body: dict) -> dict:
        request = urllib.request.Request(
            url.format(project=urllib.parse.quote(self._project, safe="")),
            data=json.dumps(body).encode(),
            method="POST",
            headers={
                "Authorization": f"Bearer {self._access_token()}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.load(response)

    def _lookup_sync(self, uid: str) -> AccountState:
        payload = self._post(LOOKUP_URL, {"localId": [uid]})

        users = payload.get("users") or []
        if not users:
            return AccountState(exists=False)

        record = users[0]
        valid_since = record.get("validSince")
        email = record.get("email")
        return AccountState(
            exists=True,
            disabled=bool(record.get("disabled", False)),
            valid_since=(datetime.fromtimestamp(int(valid_since), UTC) if valid_since else None),
            email=email.strip().lower() if isinstance(email, str) and email.strip() else None,
            email_verified=record.get("emailVerified") is True,
        )

    async def lookup(self, uid: str) -> AccountState | None:
        try:
            return await run_in_threadpool(self._lookup_sync, uid)
        except (urllib.error.URLError, TimeoutError, KeyError, ValueError, jwt.PyJWTError) as exc:
            # Fail open, loudly. Google being unreachable must not sign every
            # user out of FACET at once; the next refresh asks again.
            logger.warning("firebase account lookup failed: %s", exc.__class__.__name__)
            return None

    def _delete_sync(self, uid: str) -> None:
        try:
            self._post(DELETE_URL, {"localId": uid})
        except urllib.error.HTTPError as exc:
            # Already gone is the outcome asked for.
            if exc.code == 400 and b"USER_NOT_FOUND" in exc.read():
                return
            raise

    async def delete(self, uid: str) -> None:
        try:
            await run_in_threadpool(self._delete_sync, uid)
        except (urllib.error.URLError, TimeoutError, KeyError, ValueError, jwt.PyJWTError) as exc:
            # Fail closed: an account deleted in FACET but alive in Firebase
            # could sign straight back in to a fresh, empty account.
            logger.warning("firebase user delete failed: %s", exc.__class__.__name__)
            raise ServiceUnavailable(
                "Could not reach the sign-in service to delete your login. "
                "Nothing was deleted — please try again.",
                code="firebase_unreachable",
            ) from exc


class _Unchecked:
    """No service account configured: every account passes, said once in the log."""

    async def lookup(self, uid: str) -> AccountState | None:
        return None

    async def delete(self, uid: str) -> None:
        logger.warning(
            "FACET_FIREBASE_SERVICE_ACCOUNT is not set: the Firebase login for a "
            "deleted account was left in place"
        )


def _load_service_account(value: str) -> dict | None:
    value = value.strip()
    if not value:
        return None
    text = value if value.startswith("{") else Path(value).read_text()
    account = json.loads(text)
    if not {"client_email", "private_key"} <= account.keys():
        raise ValueError("FACET_FIREBASE_SERVICE_ACCOUNT is not a service-account key.")
    return account


@lru_cache
def _checker() -> AccountChecker:
    settings = get_settings()
    account = _load_service_account(settings.firebase_service_account)
    if account is None or not settings.firebase_project_id:
        logger.warning(
            "FACET_FIREBASE_SERVICE_ACCOUNT is not set: sessions will not end when "
            "Firebase disables, deletes or revokes a user"
        )
        return _Unchecked()
    return FirebaseAccounts(account, settings.firebase_project_id)


async def get_account_checker() -> AccountChecker:
    """The checker a route uses. Tests override this dependency."""
    return _checker()


AccountCheckerDep = Annotated[AccountChecker, Depends(get_account_checker)]
