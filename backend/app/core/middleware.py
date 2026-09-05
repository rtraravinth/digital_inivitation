"""Request-id and access logging, as pure ASGI.

Deliberately **not** written with ``@app.middleware("http")``. That builds a
``BaseHTTPMiddleware``, which runs the downstream app in a separate task and
defers the teardown of yield-dependencies until after the response body has
been sent. With a session dependency that commits on teardown, the client can
receive a token whose session row is not committed yet — and the very next
request then fails to find it. A pure ASGI middleware keeps the ordinary
ordering: the handler and its dependencies finish before the response leaves.
"""

from __future__ import annotations

import logging
import time

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.ids import new_request_id, request_id_var

logger = logging.getLogger("app.request")


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # An id supplied by a caller is honoured, so a request can be followed
        # across a proxy or from the frontend's own logs.
        request_id = Headers(scope=scope).get("x-request-id") or new_request_id()
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        status = 500

        async def send_with_request_id(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                MutableHeaders(scope=message)["X-Request-ID"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            logger.info(
                "%s %s %s",
                scope.get("method", "-"),
                scope.get("path", "-"),
                status,
                extra={
                    "method": scope.get("method"),
                    "path": scope.get("path"),
                    "status": status,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                    "request_id": request_id,
                },
            )
            request_id_var.reset(token)
