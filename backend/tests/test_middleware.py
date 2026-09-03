"""The request-context middleware must stay pure ASGI.

This is a regression guard, not a style rule. ``BaseHTTPMiddleware`` runs the
downstream app in a separate task and defers yield-dependency teardown until
after the response body is sent. With ``get_session`` committing on teardown,
that let a client receive an access token before the session row it names was
committed — so the next request answered 401 for a few milliseconds.

The race cannot be reproduced through ASGITransport, because the test harness
shares one open transaction. So the invariant is asserted directly.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware

from app.core.middleware import RequestContextMiddleware
from app.main import create_app


def test_no_base_http_middleware_is_installed():
    app = create_app()
    installed = [entry.cls for entry in app.user_middleware]

    assert RequestContextMiddleware in installed
    assert not any(
        isinstance(cls, type) and issubclass(cls, BaseHTTPMiddleware) for cls in installed
    ), "BaseHTTPMiddleware defers dependency teardown past the response; see the docstring"


async def test_every_response_carries_a_request_id(client):
    ok = await client.get("/health")
    assert ok.headers["x-request-id"]

    failed = await client.get("/api/v1/nope")
    # The same id the envelope reports, so a user quoting one can be found.
    assert failed.headers["x-request-id"] == failed.json()["error"]["request_id"]
