"""Fixtures that build accounts and their clients.

Kept out of conftest so the harness there stays about the database and the
app, and this stays about the domain.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.models import User

TEST_PASSWORD = "correct horse battery"


async def register(
    client: AsyncClient, email: str, *, name: str = "Test Person"
) -> dict:
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": TEST_PASSWORD, "name": name},
    )
    assert response.status_code == 201, response.text
    return response.json()


def bearer(client: AsyncClient, access_token: str) -> None:
    client.headers["Authorization"] = f"Bearer {access_token}"


@pytest.fixture
async def registered(client: AsyncClient) -> dict:
    return await register(client, "rohan@example.com", name="Rohan Mehta")


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
        payload = await register(other, "priya@example.com", name="Priya Nair")
        bearer(other, payload["token"]["accessToken"])
        yield other


@pytest.fixture
async def portfolio(auth_client: AsyncClient) -> dict:
    """A blank portfolio, as the create dialog's first option makes it."""
    response = await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "Rohan Mehta", "slug": "rohan", "startFrom": {"kind": "blank"}},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
async def three_sections(auth_client: AsyncClient, portfolio: dict) -> tuple[str, list[str]]:
    """A portfolio with exactly three sections, in a known order."""
    ids = [portfolio["sections"][0]["id"]]
    for _ in range(2):
        response = await auth_client.post(
            f"/api/v1/portfolios/{portfolio['id']}/sections", json={}
        )
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
        response = await second.post(
            "/api/v1/auth/login",
            json={"email": registered["user"]["email"], "password": TEST_PASSWORD},
        )
        assert response.status_code == 200, response.text
        bearer(second, response.json()["token"]["accessToken"])
        yield second
