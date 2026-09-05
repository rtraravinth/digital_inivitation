"""One error type, one envelope, one place that renders it.

Every failure a client can see is an ``AppError``. Handlers translate the
framework's own exceptions into the same shape, so a client parses exactly one
error format no matter what went wrong:

    {"error": {"code": ..., "message": ..., "details": {...}, "request_id": ...}}

``message`` is written for a person and may be shown verbatim in the UI.
``code`` is the stable string a client branches on. Internal detail — driver
messages, tracebacks, SQL — is logged and never returned.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.ids import request_id_var

logger = logging.getLogger("app.error")


class AppError(Exception):
    """Base for every error a client is allowed to see."""

    status_code: int = 500
    default_code: str = "internal_error"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code or self.default_code
        self.details = details or {}

    def envelope(self) -> dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
                "request_id": request_id_var.get(),
            }
        }


class Unauthenticated(AppError):
    status_code = 401
    default_code = "unauthenticated"


class PermissionDenied(AppError):
    status_code = 403
    default_code = "permission_denied"


class NotFound(AppError):
    status_code = 404
    default_code = "not_found"


class Conflict(AppError):
    status_code = 409
    default_code = "conflict"


class PayloadTooLarge(AppError):
    status_code = 413
    default_code = "payload_too_large"


class UnsupportedMedia(AppError):
    status_code = 415
    default_code = "unsupported_media"


class ValidationFailed(AppError):
    status_code = 422
    default_code = "validation_failed"


class RateLimited(AppError):
    status_code = 429
    default_code = "rate_limited"


_HTTP_CODES = {
    400: "bad_request",
    401: "unauthenticated",
    403: "permission_denied",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "payload_too_large",
    415: "unsupported_media",
    422: "validation_failed",
    429: "rate_limited",
}


#: Pydantic writes for developers — "value is not a valid email address: An
#: email address must have an @-sign." The UI shows these strings to a person,
#: next to the field, so they have to read like the rest of the envelope's
#: messages. Anything not covered falls through to pydantic's own text, which
#: is more use than a generic sentence that says nothing about what is wrong.
_FIELD_MESSAGES: dict[str, str] = {
    "missing": "This is required.",
    "extra_forbidden": "That is not a field this accepts.",
    "string_type": "This has to be text.",
    "bool_type": "This has to be true or false.",
    "int_type": "This has to be a whole number.",
    "int_parsing": "This has to be a whole number.",
    "float_parsing": "This has to be a number.",
    "uuid_parsing": "That is not a valid id.",
    "uuid_type": "That is not a valid id.",
    "datetime_parsing": "That is not a valid date.",
    "list_type": "This has to be a list.",
    "dict_type": "This has to be an object.",
    "model_attributes_type": "This has to be an object.",
    "json_invalid": "That is not valid JSON.",
    "string_pattern_mismatch": "That format is not allowed.",
}


def _field_message(error: dict[str, Any]) -> str:
    """Pydantic's complaint, in the register the rest of the API answers in."""
    kind = str(error.get("type", ""))
    if kind in _FIELD_MESSAGES:
        return _FIELD_MESSAGES[kind]

    ctx = error.get("ctx") or {}
    match kind:
        case "string_too_short":
            return f"Use at least {ctx.get('min_length')} characters."
        case "string_too_long":
            return f"Use at most {ctx.get('max_length')} characters."
        case "too_short":
            return f"Give at least {ctx.get('min_length')}."
        case "too_long":
            return f"Give at most {ctx.get('max_length')}."
        case "greater_than_equal":
            return f"This has to be {ctx.get('ge')} or more."
        case "less_than_equal":
            return f"This has to be {ctx.get('le')} or less."
        case "literal_error":
            return f"Pick one of: {ctx.get('expected')}."

    message = str(error.get("msg", "That value is not valid."))
    if message.startswith("value is not a valid email address"):
        return "Enter an email address in the form name@example.com."
    # A validator in app/schemas writes its own wording, and it is already
    # written for a person. Keep it, without the prefix pydantic adds.
    return message.removeprefix("Value error, ")


def _render(error: AppError) -> JSONResponse:
    response = JSONResponse(status_code=error.status_code, content=error.envelope())
    if error.status_code == 401:
        # A 401 without this header is not a complete 401.
        response.headers["WWW-Authenticate"] = "Bearer"
    return response


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        if exc.status_code >= 500:
            logger.exception("unhandled app error", exc_info=exc)
        return _render(exc)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [
            {
                # Drop the "body"/"query" prefix: the client knows where it
                # put the value, it needs the path within it.
                "field": ".".join(str(part) for part in error["loc"][1:]) or "body",
                "message": _field_message(error),
                "type": error["type"],
            }
            for error in exc.errors()
        ]
        return _render(
            ValidationFailed("Some of those values are not valid.", details={"fields": fields})
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        if exc.status_code >= 500:
            logger.error("http error %s: %s", exc.status_code, exc.detail)
            return _render(http_error(exc.status_code, "Something went wrong.", "internal_error"))
        detail = exc.detail if isinstance(exc.detail, str) else None
        return _render(http_error(exc.status_code, detail or _default_message(exc.status_code)))

    @app.exception_handler(IntegrityError)
    async def _integrity(_: Request, exc: IntegrityError) -> JSONResponse:
        # A constraint reached the database that a service should have caught.
        # Log the real one; tell the client only that it conflicts.
        logger.warning("integrity error: %s", exc.orig, exc_info=exc)
        return _render(
            Conflict("That change conflicts with something already stored.",
                     code="constraint_violation")
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled exception", exc_info=exc)
        return _render(AppError("Something went wrong.", code="internal_error"))


_DEFAULT_MESSAGES = {
    401: "You need to sign in to do that.",
    403: "You do not have access to that.",
    404: "That does not exist.",
    405: "That method is not allowed here.",
}


def _default_message(status_code: int) -> str:
    return _DEFAULT_MESSAGES.get(status_code, "Request failed.")


class _StatusCarrier(AppError):
    """An AppError whose status is set per-instance.

    Only the HTTPException handler needs this: it has to preserve a status
    code that no subclass in the hierarchy above declares.
    """


def http_error(status_code: int, message: str, code: str | None = None) -> AppError:
    error = _StatusCarrier(message, code=code or _HTTP_CODES.get(status_code, "http_error"))
    error.status_code = status_code
    return error
