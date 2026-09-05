"""Shared schema plumbing.

Every schema in the project inherits ``CamelModel``. The frontend is
TypeScript and reads ``customDomain``; Python writes ``custom_domain``. Doing
the translation once here means no hand-written key mapping in the client and
no snake_case leaking into the API surface.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class StrictCamelModel(CamelModel):
    """Rejects unknown keys.

    Used for partial-update payloads, where a misspelled field would
    otherwise be silently dropped and look like a save that did nothing.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="forbid",
    )


class ErrorBody(CamelModel):
    code: str
    message: str
    details: dict[str, Any] = {}
    request_id: str = ""

    model_config = ConfigDict(populate_by_name=True)


class ErrorEnvelope(BaseModel):
    """Documents the error shape in the OpenAPI schema."""

    error: ErrorBody


#: Attach to routers so /docs shows the real error shape, not FastAPI's default.
ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    400: {"model": ErrorEnvelope, "description": "Bad request"},
    401: {"model": ErrorEnvelope, "description": "Not signed in"},
    404: {"model": ErrorEnvelope, "description": "Not found"},
    409: {"model": ErrorEnvelope, "description": "Conflict"},
    422: {"model": ErrorEnvelope, "description": "Validation failed"},
}
