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

import json
import logging
import re
import time

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.ids import new_request_id, request_id_var

logger = logging.getLogger("app.request")

#: A caller's own request id is kept only if it looks like one. Anything else
#: — a megabyte of text, a line break meant to forge a log line — is replaced.
_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # An id supplied by a caller is honoured, so a request can be followed
        # across a proxy or from the frontend's own logs.
        offered = Headers(scope=scope).get("x-request-id") or ""
        request_id = offered if _REQUEST_ID.fullmatch(offered) else new_request_id()
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


class BodySizeLimitMiddleware:
    """Refuse a request body over ``limit`` bytes with a 413.

    ``Content-Length`` is checked first, then the bytes actually received are
    counted, since a chunked request need not declare a length at all.
    """

    def __init__(self, app: ASGIApp, limit: int) -> None:
        self.app = app
        self.limit = limit

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        declared = Headers(scope=scope).get("content-length")
        if declared and declared.isdigit() and int(declared) > self.limit:
            await self._too_large(send)
            return

        received = 0
        answered = False

        async def counted_receive() -> Message:
            nonlocal received, answered
            if answered:
                return {"type": "http.disconnect"}
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.limit:
                    # Answer now and tell the app the client left: whatever
                    # it does with that, nothing past the limit is read.
                    answered = True
                    await self._too_large(send)
                    return {"type": "http.disconnect"}
            return message

        async def guarded_send(message: Message) -> None:
            if not answered:
                await send(message)

        await self.app(scope, counted_receive, guarded_send)

    async def _too_large(self, send: Send) -> None:
        body = json.dumps(
            {
                "error": {
                    "code": "payload_too_large",
                    "message": "That request is too large.",
                    "details": {"limit": self.limit},
                    "request_id": request_id_var.get(),
                }
            }
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


#: The API returns JSON and stored files, never a page: nothing it sends may
#: run a script, load anything, or be framed. Asset responses carry their own
#: policy (``UPLOAD_CSP``); a header already set is left alone.
_API_SECURITY_HEADERS = (
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"no-referrer"),
    (b"x-frame-options", b"DENY"),
    (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"),
    (b"cross-origin-resource-policy", b"same-site"),
)


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, *, hsts: bool) -> None:
        self.app = app
        self.headers = _API_SECURITY_HEADERS + (
            ((b"strict-transport-security", b"max-age=63072000; includeSubDomains"),)
            if hsts
            else ()
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                existing = message.get("headers", [])
                present = {name.lower() for name, _ in existing}
                if (b"content-type", b"application/pdf") in existing:
                    # Chrome's PDF viewer will not open under object-src
                    # 'none'; see SANDBOX_EXEMPT in api/v1/assets.py.
                    present.add(b"content-security-policy")
                message["headers"] = list(existing) + [
                    header for header in self.headers if header[0] not in present
                ]
            await send(message)

        await self.app(scope, receive, send_with_headers)
