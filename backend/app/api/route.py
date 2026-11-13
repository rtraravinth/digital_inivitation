"""The route class that commits a request's transaction before it answers.

A dependency with ``yield`` runs its exit code *after* the response has been
sent (FastAPI 0.106 onwards). Committing there means the handler can hand a
client an access token, or an asset id, that names a row no other connection
can see yet — so the very next request reads the old snapshot and 404s, or
raises ``session_revoked`` for a session that was created a millisecond ago.

Under load that showed up as roughly one sign-in in twenty bouncing straight
back to the sign-in screen. The fix is not to commit sooner in the service —
services still never commit — but to commit here, after the handler has
produced a response and before that response goes out.

Errors keep the old path: the handler raises, this never runs, and the
session dependency rolls back — unless the error is an ``AppError`` raised
with ``keep_writes=True``, whose writes are committed before it propagates.
That is how "your sessions were revoked" can revoke them.
"""

from __future__ import annotations

from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Request, Response
from fastapi.routing import APIRoute

from app.core.errors import AppError
from app.db.session import SESSION_STATE_ATTR


class TransactionRoute(APIRoute):
    """An ``APIRoute`` that commits the request's session before responding."""

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        handle = super().get_route_handler()

        async def commit_then_respond(request: Request) -> Response:
            try:
                response = await handle(request)
            except AppError as error:
                session = getattr(request.state, SESSION_STATE_ATTR, None)
                if error.keep_writes and session is not None:
                    await session.commit()
                raise
            session = getattr(request.state, SESSION_STATE_ATTR, None)
            if session is not None:
                await session.commit()
            return response

        return commit_then_respond
