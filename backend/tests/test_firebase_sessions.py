"""FACET's sessions end when Firebase's do.

Firebase ends a user's sessions when the user is deleted or disabled, or when
``validSince`` moves past the sign-in (a password reset, an email change, an
admin revocation). ``refresh`` asks on every rotation and follows suit; a
sign-in older than ``validSince`` opens nothing at all.
"""

from __future__ import annotations

import io
import json
import time
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.api.route import TransactionRoute
from app.core import firebase_accounts as fa
from app.core.errors import Unauthenticated, install_error_handlers
from app.core.firebase_accounts import AccountState
from app.db.session import SESSION_STATE_ATTR
from app.models import AuthSession
from tests.factories import bearer, firebase_token, sign_in

UID = "uid-rohan@example.com"


async def test_an_unchecked_account_refreshes_as_before(client, registered):
    assert (await client.post("/api/v1/auth/refresh")).status_code == 200


async def test_a_disabled_user_loses_every_session(
    client, registered, second_login, firebase_accounts
):
    firebase_accounts.states[UID] = AccountState(exists=True, disabled=True)

    response = await client.post("/api/v1/auth/refresh")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "account_disabled"

    # The other device is cut off too, on its very next request.
    assert (await second_login.get("/api/v1/auth/sessions")).status_code == 401


async def test_a_deleted_user_loses_every_session(client, registered, firebase_accounts):
    firebase_accounts.states[UID] = AccountState(exists=False)

    response = await client.post("/api/v1/auth/refresh")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "account_disabled"


async def test_a_password_reset_ends_sessions_signed_in_before_it(
    client, registered, firebase_accounts
):
    firebase_accounts.states[UID] = AccountState(
        exists=True, valid_since=datetime.now(UTC) + timedelta(seconds=5)
    )

    response = await client.post("/api/v1/auth/refresh")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "firebase_session_revoked"

    bearer(client, registered["token"]["accessToken"])
    assert (await client.get("/api/v1/auth/sessions")).status_code == 401


async def test_signing_in_after_the_reset_works(app, client, registered, firebase_accounts):
    reset = time.time()
    firebase_accounts.states[UID] = AccountState(
        exists=True, valid_since=datetime.fromtimestamp(int(reset), UTC)
    )

    fresh = await sign_in(client, firebase_token("rohan@example.com", auth_time=reset + 1))
    assert fresh.status_code == 200
    assert (await client.post("/api/v1/auth/refresh")).status_code == 200


async def test_a_token_from_before_the_reset_opens_nothing(client, registered, firebase_accounts):
    firebase_accounts.states[UID] = AccountState(
        exists=True, valid_since=datetime.now(UTC) + timedelta(seconds=5)
    )
    response = await sign_in(client, firebase_token("rohan@example.com"))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "firebase_session_revoked"


async def test_a_disabled_user_cannot_sign_in(client, firebase_accounts):
    firebase_accounts.states["uid-off@example.com"] = AccountState(exists=True, disabled=True)
    response = await sign_in(client, firebase_token("off@example.com"), handle="off-person")
    assert response.status_code == 401


async def test_google_unreachable_keeps_people_signed_in(client, registered, firebase_accounts):
    """Fail open: an outage at Google must not sign every user out at once."""
    firebase_accounts.states[UID] = None
    assert (await client.post("/api/v1/auth/refresh")).status_code == 200


async def test_the_sign_in_moment_survives_rotation(client, registered, db_session):
    first = await db_session.scalar(
        select(AuthSession).order_by(AuthSession.created_at.asc()).limit(1)
    )
    await client.post("/api/v1/auth/refresh")
    rows = list(await db_session.scalars(select(AuthSession)))
    assert len(rows) == 2
    assert {row.signed_in_at for row in rows} == {first.signed_in_at}


# ── the state itself ────────────────────────────────────────────────────


def test_allows_compares_whole_seconds():
    reset = datetime(2026, 11, 13, 12, 0, 0, tzinfo=UTC)
    state = AccountState(exists=True, valid_since=reset)
    assert state.allows(reset + timedelta(milliseconds=400))
    assert not state.allows(reset - timedelta(seconds=1))
    assert AccountState(exists=True).allows(reset)
    assert not AccountState(exists=False).allows(reset)
    assert not AccountState(exists=True, disabled=True).allows(reset)


# ── the admin lookup, against a stubbed Google ───────────────────────────


@pytest.fixture
def stub_google(monkeypatch):
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    calls: list[str] = []
    replies: dict[str, dict] = {}

    def urlopen(request, timeout):
        calls.append(request.full_url)
        if request.full_url == fa.TOKEN_URL:
            return io.BytesIO(json.dumps({"access_token": "tok", "expires_in": 3600}).encode())
        assert request.headers["Authorization"] == "Bearer tok"
        return io.BytesIO(json.dumps(replies["lookup"]).encode())

    monkeypatch.setattr(fa.urllib.request, "urlopen", urlopen)
    accounts = fa.FirebaseAccounts(
        {"client_email": "svc@example.iam.gserviceaccount.com", "private_key": pem}, "proj"
    )
    return accounts, replies, calls


async def test_lookup_reads_disabled_and_valid_since(stub_google):
    accounts, replies, calls = stub_google
    replies["lookup"] = {"users": [{"localId": "u1", "disabled": True, "validSince": "1763000000"}]}

    state = await accounts.lookup("u1")
    assert state == AccountState(
        exists=True, disabled=True, valid_since=datetime.fromtimestamp(1763000000, UTC)
    )
    assert calls[0] == fa.TOKEN_URL
    assert calls[1].endswith("/projects/proj/accounts:lookup")


async def test_lookup_of_a_missing_user_says_so_and_reuses_the_token(stub_google):
    accounts, replies, calls = stub_google
    replies["lookup"] = {"kind": "identitytoolkit#GetAccountInfoResponse"}

    assert await accounts.lookup("gone") == AccountState(exists=False)
    assert await accounts.lookup("gone") == AccountState(exists=False)
    assert calls.count(fa.TOKEN_URL) == 1


async def test_lookup_failure_is_none_not_an_error(monkeypatch):
    def broken(request, timeout):
        raise fa.urllib.error.URLError("down")

    monkeypatch.setattr(fa.urllib.request, "urlopen", broken)
    accounts = fa.FirebaseAccounts({"client_email": "x", "private_key": "y"}, "proj")
    assert await accounts.lookup("u1") is None


def test_a_key_that_is_not_a_service_account_is_refused():
    with pytest.raises(ValueError):
        fa._load_service_account('{"type": "something-else"}')
    assert fa._load_service_account("") is None


# ── deleting the account deletes the Firebase login ──────────────────────


async def test_deleting_the_account_deletes_the_firebase_user(
    auth_client, registered, firebase_accounts
):
    assert (await auth_client.delete("/api/v1/account")).status_code == 204
    assert firebase_accounts.deleted == [UID]


async def test_firebase_unreachable_deletes_nothing(
    auth_client, registered, firebase_accounts, db_session
):

    firebase_accounts.unreachable = True
    response = await auth_client.delete("/api/v1/account")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "firebase_unreachable"


async def test_lookup_delete_treats_a_missing_user_as_done(stub_google, monkeypatch):
    accounts, _, _ = stub_google

    def missing(request, timeout):
        if request.full_url == fa.TOKEN_URL:
            return io.BytesIO(json.dumps({"access_token": "tok", "expires_in": 3600}).encode())
        raise fa.urllib.error.HTTPError(
            request.full_url, 400, "Bad", {}, io.BytesIO(b'{"error":{"message":"USER_NOT_FOUND"}}')
        )

    monkeypatch.setattr(fa.urllib.request, "urlopen", missing)
    await accounts.delete("gone")


async def test_delete_fails_closed_when_google_is_down(monkeypatch):
    from app.core.errors import ServiceUnavailable

    def broken(request, timeout):
        raise fa.urllib.error.URLError("down")

    monkeypatch.setattr(fa.urllib.request, "urlopen", broken)
    accounts = fa.FirebaseAccounts({"client_email": "x", "private_key": "y"}, "proj")
    with pytest.raises(ServiceUnavailable):
        await accounts.delete("u1")


# ── an email changed in Firebase reaches FACET ───────────────────────────


async def _email_of(db_session) -> str:
    from app.models import User

    user = await db_session.scalar(select(User).where(User.firebase_uid == UID))
    await db_session.refresh(user)
    return user.email


async def test_a_verified_new_email_is_copied_on_refresh(
    client, registered, firebase_accounts, db_session
):
    firebase_accounts.states[UID] = AccountState(
        exists=True, email="New@Example.com".lower(), email_verified=True
    )
    assert (await client.post("/api/v1/auth/refresh")).status_code == 200
    assert await _email_of(db_session) == "new@example.com"


async def test_an_unverified_new_email_is_not_copied(
    client, registered, firebase_accounts, db_session
):
    firebase_accounts.states[UID] = AccountState(
        exists=True, email="unverified@example.com", email_verified=False
    )
    await client.post("/api/v1/auth/refresh")
    assert await _email_of(db_session) == "rohan@example.com"


async def test_an_email_another_account_holds_is_not_copied(
    client, registered, other_auth_client, firebase_accounts, db_session
):
    firebase_accounts.states[UID] = AccountState(
        exists=True, email="priya@example.com", email_verified=True
    )
    await client.post("/api/v1/auth/refresh")
    assert await _email_of(db_session) == "rohan@example.com"


async def test_lookup_reads_the_email(stub_google):
    accounts, replies, _ = stub_google
    replies["lookup"] = {"users": [{"localId": "u1", "email": "A@B.co", "emailVerified": True}]}
    state = await accounts.lookup("u1")
    assert (state.email, state.email_verified) == ("a@b.co", True)


# ── an error that reports a revocation keeps it ──────────────────────────


async def test_keep_writes_commits_before_the_error_and_others_do_not():
    """The test app shares one transaction, so this drives the route directly."""
    commits: list[str] = []

    class Session:
        async def commit(self):
            commits.append("commit")

    app = FastAPI()
    install_error_handlers(app)
    app.router.route_class = TransactionRoute

    @app.get("/keep")
    async def keep(request: Request):
        setattr(request.state, SESSION_STATE_ATTR, Session())
        raise Unauthenticated("revoked", code="x", keep_writes=True)

    @app.get("/drop")
    async def drop(request: Request):
        setattr(request.state, SESSION_STATE_ATTR, Session())
        raise Unauthenticated("nope", code="y")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        assert (await c.get("/drop")).status_code == 401
        assert commits == []
        assert (await c.get("/keep")).status_code == 401
        assert commits == ["commit"]
