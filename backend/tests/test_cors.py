"""Which browser origins may call the API."""

from __future__ import annotations

import pytest

PREFLIGHT = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"}


@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        # This machine's LAN address, which DHCP changes: a published page
        # opened from it must still be able to report its views and clicks.
        "http://192.168.0.5:3000",
        "http://10.1.2.3:3000",
        "http://172.20.0.4:3000",
    ],
)
async def test_local_and_lan_origins_are_allowed_outside_production(client, origin):
    response = await client.options(
        "/api/v1/auth/register", headers={"Origin": origin, **PREFLIGHT}
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


@pytest.mark.parametrize(
    "origin",
    [
        "http://evil.example:3000",
        # A private address on another port is not the dev server.
        "http://192.168.0.5:8080",
        # A public address dressed up to start like a private one.
        "http://192.168.0.5.evil.example:3000",
    ],
)
async def test_other_origins_are_refused(client, origin):
    response = await client.options(
        "/api/v1/auth/register", headers={"Origin": origin, **PREFLIGHT}
    )
    assert response.status_code == 400


def test_production_does_not_widen_the_list():
    from app.core.config import Settings

    assert Settings(env="prod").cors_origin_regex is None
    assert Settings(env="dev").cors_origin_regex is not None
