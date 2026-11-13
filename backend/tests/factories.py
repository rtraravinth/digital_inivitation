"""Fixtures that build accounts and their clients.

Kept out of conftest so the harness there stays about the database and the
app, and this stays about the domain.
"""

from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator
from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.errors import Unauthenticated
from app.core.firebase import FirebaseIdentity
from app.core.firebase_accounts import AccountState
from app.models import User

#: Tokens the fake verifier accepts start with this. Anything else is refused,
#: the way Google's keys would refuse a forgery.
FAKE_TOKEN_PREFIX = "fake-firebase-token:"

#: The first user's handle. Published addresses are
#: /api/v1/public/p/<handle>/<slug>, so tests need it by name.
TEST_HANDLE = "rohan"

#: The second user's, for the tests that prove one account cannot reach
#: another's pages through its own handle.
OTHER_HANDLE = "priya"


def firebase_token(
    email: str | None,
    *,
    uid: str | None = None,
    verified: bool = True,
    provider: str = "password",
    name: str = "",
    phone: str | None = None,
    auth_time: float | None = None,
) -> str:
    """What Firebase would hand the browser, for the fake verifier to read.

    The uid defaults to one derived from the address, so signing in twice as
    the same person gives the same uid — as Firebase does.
    """
    return FAKE_TOKEN_PREFIX + json.dumps(
        {
            "uid": uid or f"uid-{email or phone}",
            "email": email,
            "email_verified": verified,
            "phone": phone,
            "name": name,
            "provider": provider,
            "auth_time": auth_time if auth_time is not None else time.time(),
        }
    )


async def fake_verify(token: str) -> FirebaseIdentity:
    """Stands in for Google. Real verification is tested in test_firebase.py."""
    if not token.startswith(FAKE_TOKEN_PREFIX):
        raise Unauthenticated(
            "That sign-in could not be confirmed. Please try again.",
            code="invalid_firebase_token",
        )
    claims = json.loads(token[len(FAKE_TOKEN_PREFIX) :])
    return FirebaseIdentity(
        uid=claims["uid"],
        # Lowercased as the real verifier does.
        email=claims["email"].lower() if claims["email"] else None,
        email_verified=claims["email_verified"],
        phone=claims["phone"],
        name=claims["name"],
        provider=claims["provider"],
        auth_time=datetime.fromtimestamp(claims["auth_time"], UTC),
    )


class FakeAccounts:
    """Stands in for Firebase's admin lookup. A uid with no entry is unchecked."""

    def __init__(self) -> None:
        self.states: dict[str, AccountState | None] = {}
        self.deleted: list[str] = []
        self.unreachable = False

    async def lookup(self, uid: str) -> AccountState | None:
        return self.states.get(uid)

    async def delete(self, uid: str) -> None:
        if self.unreachable:
            from app.core.errors import ServiceUnavailable

            raise ServiceUnavailable(
                "Could not reach the sign-in service.", code="firebase_unreachable"
            )
        self.deleted.append(uid)


async def sign_in(client: AsyncClient, token: str, **extra) -> object:
    """POST /auth/firebase. Returns the raw response for the caller to check."""
    return await client.post("/api/v1/auth/firebase", json={"idToken": token, **extra})


async def register(
    client: AsyncClient, email: str, *, name: str = "Test Person", handle: str | None = None
) -> dict:
    # The handle is the base of every address the account publishes, so it is
    # required at sign-up. Derived from the local part here so a test that
    # does not care about addresses still gets a valid one.
    response = await sign_in(
        client,
        firebase_token(email),
        name=name,
        handle=handle or email.split("@")[0].replace(".", "-"),
    )
    assert response.status_code == 200, response.text
    return response.json()


def bearer(client: AsyncClient, access_token: str) -> None:
    client.headers["Authorization"] = f"Bearer {access_token}"


@pytest.fixture
async def registered(client: AsyncClient) -> dict:
    return await register(client, "rohan@example.com", name="Rohan Mehta", handle=TEST_HANDLE)


@pytest.fixture
async def registered_user(registered: dict, db_session) -> User:
    return await db_session.scalar(select(User).where(User.email == registered["user"]["email"]))


@pytest.fixture
async def auth_client(client: AsyncClient, registered: dict) -> AsyncClient:
    """The first user, signed in. Shares the registration's refresh cookie."""
    bearer(client, registered["token"]["accessToken"])
    return client


@pytest.fixture
async def other_auth_client(app) -> AsyncIterator[AsyncClient]:
    """A second, unrelated account — the one every ownership test uses."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0) Firefox/133.0"},
    ) as other:
        payload = await register(other, "priya@example.com", name="Priya Nair", handle=OTHER_HANDLE)
        bearer(other, payload["token"]["accessToken"])
        yield other


@pytest.fixture
async def portfolio(auth_client: AsyncClient) -> dict:
    """A portfolio with one empty section: a blank one, plus its first."""
    response = await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "Rohan Mehta", "slug": "rohan", "startFrom": {"kind": "blank"}},
    )
    assert response.status_code == 201, response.text
    created = response.json()

    # A blank portfolio has no sections. Most tests are about one, so this
    # fixture adds it, the way its owner would as their first step.
    added = await auth_client.post(f"/api/v1/portfolios/{created['id']}/sections", json={})
    assert added.status_code == 201, added.text
    return (await auth_client.get(f"/api/v1/portfolios/{created['id']}")).json()


@pytest.fixture
async def three_sections(auth_client: AsyncClient, portfolio: dict) -> tuple[str, list[str]]:
    """A portfolio with exactly three sections, in a known order."""
    ids = [portfolio["sections"][0]["id"]]
    for _ in range(2):
        response = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/sections", json={})
        assert response.status_code == 201, response.text
        ids.append(response.json()["id"])
    return portfolio["id"], ids


@pytest.fixture
async def published(auth_client: AsyncClient, portfolio: dict) -> dict:
    response = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/publish")
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
async def second_login(app, registered: dict) -> AsyncIterator[AsyncClient]:
    """The *same* user signed in again from another device."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/605.1"},
    ) as second:
        response = await sign_in(second, firebase_token(registered["user"]["email"]))
        assert response.status_code == 200, response.text
        bearer(second, response.json()["token"]["accessToken"])
        yield second
