"""Per-client request limits.

One process serves the API (``scripts/start.sh``), so the counters live in its
memory: a sliding window of timestamps per (rule, client). Running more than
one API process would give each its own counters, which multiplies the limits
by the process count — move this to Redis or Postgres before doing that.

A signed-in caller is counted by user id, everyone else by IP. The IP is the
one uvicorn resolved from ``X-Forwarded-For`` — it trusts only the local Next
server (``--forwarded-allow-ips 127.0.0.1``), so a client cannot pick its own.
"""

from __future__ import annotations

import math
import time
from collections import OrderedDict, deque
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request

from app.core.config import get_settings
from app.core.errors import RateLimited

#: Clients remembered at once. Past this, the least recently seen is dropped:
#: memory stays bounded however many addresses a flood comes from.
MAX_TRACKED = 50_000


@dataclass(frozen=True)
class Rule:
    name: str
    limit: int
    window_seconds: float


class SlidingWindow:
    def __init__(self) -> None:
        self._hits: OrderedDict[tuple[str, str], deque[float]] = OrderedDict()

    def hit(self, rule: Rule, client: str, now: float) -> float:
        """Record a request. Returns 0 if allowed, else seconds until it would be."""
        key = (rule.name, client)
        hits = self._hits.get(key)
        if hits is None:
            hits = deque()
            self._hits[key] = hits
            if len(self._hits) > MAX_TRACKED:
                self._hits.popitem(last=False)
        else:
            self._hits.move_to_end(key)

        cutoff = now - rule.window_seconds
        while hits and hits[0] <= cutoff:
            hits.popleft()
        if len(hits) >= rule.limit:
            return hits[0] + rule.window_seconds - now
        hits.append(now)
        return 0.0

    def reset(self) -> None:
        self._hits.clear()


WINDOW = SlidingWindow()

# Generous for a person, tight for a script. A page load records one view, and
# a visitor clicks a handful of links.
SIGN_IN = Rule("sign_in", 10, 60)
REFRESH = Rule("refresh", 30, 60)
PAGE_VIEW = Rule("page_view", 30, 60)
LINK_CLICK = Rule("link_click", 60, 60)
UPLOAD = Rule("upload", 30, 60)
IMPORT = Rule("import", 5, 60)


def client_key(request: Request) -> str:
    """The caller's user id when a valid access token came with the request.

    Read from ``request.state`` rather than decoded again: ``get_caller`` puts
    it there. Anything else is counted by address.
    """
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


def _wait(rule: Rule, request: Request) -> float:
    if not get_settings().rate_limit_enabled:
        return 0.0
    return WINDOW.hit(rule, client_key(request), time.monotonic())


def allowed(rule: Rule, request: Request) -> bool:
    """Count the request; False once over the limit. For callers that must
    not answer 429 — a visitor never sees an analytics decision."""
    return _wait(rule, request) == 0


def enforce(rule: Rule, request: Request) -> None:
    wait = _wait(rule, request)
    if wait > 0:
        raise RateLimited(
            "Too many requests. Please wait a moment and try again.",
            details={"retryAfter": math.ceil(wait)},
            headers={"Retry-After": str(math.ceil(wait))},
        )


def limit(rule: Rule):
    """A dependency that counts this request against ``rule``."""

    def dependency(request: Request) -> None:
        enforce(rule, request)

    return Depends(dependency)


SignInLimit = Annotated[None, limit(SIGN_IN)]
RefreshLimit = Annotated[None, limit(REFRESH)]
PageViewLimit = Annotated[None, limit(PAGE_VIEW)]
LinkClickLimit = Annotated[None, limit(LINK_CLICK)]
UploadLimit = Annotated[None, limit(UPLOAD)]
ImportLimit = Annotated[None, limit(IMPORT)]
