"""The FastAPI application.

Assembly only: middleware, error handlers, routers. Nothing here knows what a
portfolio is.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware

logger = logging.getLogger("app.request")

DESCRIPTION = """
The FACET portfolio builder API.

Every error uses one envelope:

    {"error": {"code": "...", "message": "...", "details": {}, "request_id": "..."}}

Branch on `code`; `message` is written to be shown to a person.

Authenticate with `POST /api/v1/auth/login`, then send the access token as
`Authorization: Bearer <token>`. The refresh token is set as an httpOnly
cookie and is never returned in a response body.

Billing, custom-domain DNS and outbound email are deliberately not
implemented — they need third-party services this project has not chosen.
The related settings are stored and honestly labelled as inert.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.media_root.mkdir(parents=True, exist_ok=True)
    logger.info("api starting", extra={"env": settings.env})
    yield
    from app.db.session import dispose_engine

    await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging("INFO" if settings.env != "test" else "WARNING")

    app = FastAPI(
        title="FACET API",
        version="1.0.0",
        description=DESCRIPTION,
        lifespan=lifespan,
        docs_url=None if settings.is_prod else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_prod else "/openapi.json",
    )

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    install_error_handlers(app)

    @app.get("/health", tags=["meta"], summary="Liveness check")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    from app.api.router import api_router

    app.include_router(api_router)

    return app


app = create_app()
