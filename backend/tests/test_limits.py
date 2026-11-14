"""Request limits: rate, body size, storage, and Google key refetches."""

from __future__ import annotations

import pytest

from app.core import firebase as fb
from app.core.config import get_settings
from app.core.ratelimit import WINDOW


@pytest.fixture
def limits_on(monkeypatch):
    """The suite runs with limits off; these tests are about them."""
    monkeypatch.setattr(get_settings(), "rate_limit_enabled", True)
    WINDOW.reset()
    yield
    WINDOW.reset()


async def _published(auth_client, portfolio) -> tuple[str, str]:
    await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/publish")
    handle = (await auth_client.get("/api/v1/account")).json()["profile"]["handle"]
    return handle, portfolio["slug"]


async def test_page_views_past_the_limit_are_quietly_not_counted(
    auth_client, client, portfolio, limits_on
):
    handle, slug = await _published(auth_client, portfolio)
    url = f"/api/v1/public/p/{handle}/{slug}/views"
    answers = [
        await client.post(url, json={"referrer": "", "dedupeKey": f"k{i}"}) for i in range(35)
    ]
    # A visitor never sees an analytics decision: 202 every time.
    assert {a.status_code for a in answers} == {202}
    counted = [a.json()["counted"] for a in answers]
    assert counted[:30] == [True] * 30
    assert counted[30:] == [False] * 5


async def test_sign_in_attempts_are_limited_per_address(client, limits_on):
    for _ in range(10):
        await client.post("/api/v1/auth/firebase", json={"idToken": "not-a-token"})
    refused = await client.post("/api/v1/auth/firebase", json={"idToken": "not-a-token"})
    assert refused.status_code == 429
    assert refused.json()["error"]["code"] == "rate_limited"
    assert int(refused.headers["Retry-After"]) > 0


async def test_uploads_are_limited_per_account(auth_client, limits_on):
    files = {"file": ("a.txt", b"hello", "text/plain")}
    answers = [
        (await auth_client.post("/api/v1/assets", files=files, data={"kind": "file"})).status_code
        for _ in range(31)
    ]
    assert answers[:30] == [201] * 30
    assert answers[30] == 429


async def test_a_body_over_the_limit_is_refused_without_being_read(auth_client, monkeypatch):
    from app.core.middleware import BodySizeLimitMiddleware

    # The app was built with the setting; shrink the live middleware's limit.
    app = auth_client._transport.app
    layer = app.middleware_stack
    while layer is not None and not isinstance(layer, BodySizeLimitMiddleware):
        layer = getattr(layer, "app", None)
    assert layer is not None
    monkeypatch.setattr(layer, "limit", 1024)

    response = await auth_client.post(
        "/api/v1/assets",
        files={"file": ("big.txt", b"x" * 4096, "text/plain")},
        data={"kind": "file"},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"


async def test_uploads_stop_at_the_storage_quota(auth_client, monkeypatch):
    monkeypatch.setattr(get_settings(), "storage_quota_bytes", 10)
    response = await auth_client.post(
        "/api/v1/assets",
        files={"file": ("a.txt", b"more than ten bytes", "text/plain")},
        data={"kind": "file"},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "storage_full"


def test_an_unknown_key_id_refetches_googles_keys_at_most_once_a_minute(monkeypatch):
    fetches = []

    class FakeClient:
        def get_signing_keys(self, refresh=False):
            if refresh:
                fetches.append(1)
            return []

    monkeypatch.setattr(fb, "_jwks_client", lambda: FakeClient())
    monkeypatch.setattr(fb, "_last_refetch", 0.0)
    monkeypatch.setattr(fb.jwt, "get_unverified_header", lambda _: {"kid": "forged"})

    for _ in range(5):
        with pytest.raises(fb.Unauthenticated):
            fb._signing_key("token")
    assert len(fetches) == 1


async def test_a_hostile_request_id_is_replaced(client):
    response = await client.get("/health", headers={"X-Request-ID": "x" * 500})
    assert response.headers["X-Request-ID"] != "x" * 500
    kept = await client.get("/health", headers={"X-Request-ID": "trace-123"})
    assert kept.headers["X-Request-ID"] == "trace-123"


async def test_every_api_response_carries_the_security_headers(client):
    response = await client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert (
        response.headers["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"
    )
