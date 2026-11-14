"""Shared schema plumbing.

Every schema in the project inherits ``CamelModel``. The frontend is
TypeScript and reads ``customDomain``; Python writes ``custom_domain``. Doing
the translation once here means no hand-written key mapping in the client and
no snake_case leaking into the API surface.
"""

from __future__ import annotations

import re
from typing import Annotated, Any

from pydantic import AfterValidator, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

#: A scheme, as a browser reads one: letters first, then a colon. Not one
#: followed by a digit, which is a port ("localhost:3000"), not a scheme.
_SCHEME = re.compile(r"^([a-zA-Z][a-zA-Z0-9+.\-]*):(?!\d)")

#: Every scheme a link on a page may use. ``javascript:``, ``data:`` and
#: ``vbscript:`` can run code when clicked; nothing a person links to needs
#: anything outside this list.
SAFE_SCHEMES = frozenset({"http", "https", "mailto", "tel"})


def safe_url(value: str) -> str:
    """The address, or "" if it could run code when opened.

    Emptied rather than refused, because stored rows are read back through
    the same schemas: refusing would turn one bad row from an older build
    into a page that cannot load. A bare host ("northwell.in") is kept; the
    frontend completes it with https://.
    """
    # Browsers drop tabs and newlines inside a scheme: "java\tscript:".
    if any(ord(char) < 0x20 or ord(char) == 0x7F for char in value):
        return ""
    match = _SCHEME.match(value.strip())
    if match and match.group(1).lower() not in SAFE_SCHEMES:
        return ""
    return value


SafeUrl = Annotated[str, Field(max_length=2000), AfterValidator(safe_url)]


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
