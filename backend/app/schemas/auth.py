"""Auth request and response bodies."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import EmailStr, Field, field_validator

from app.schemas.account import HANDLE_PATTERN
from app.schemas.common import CamelModel


class FirebaseSignInRequest(CamelModel):
    """A Firebase ID token, traded for a FACET session.

    ``name`` and ``handle`` are read only when the token belongs to nobody
    yet — they are what a new account is made with. An existing account
    ignores them; its profile is edited on /account.
    """

    #: A Firebase ID token is a JWT of roughly 1KB; the cap is generous.
    id_token: str = Field(min_length=20, max_length=8192)
    name: str | None = Field(default=None, max_length=200)
    #: The base of every address the account will ever publish —
    #: facet.com/<handle>/<slug>. Asked for before the account exists, so an
    #: account can never be without one.
    handle: str | None = Field(default=None, pattern=HANDLE_PATTERN)

    @field_validator("handle", mode="before")
    @classmethod
    def _normalise_handle(cls, value: str | None) -> str | None:
        # Before, not after: the pattern is lowercase-only, so trimming and
        # lowercasing has to happen first or "Aravinth" fails as a format
        # error rather than being read as the typo it is.
        if not isinstance(value, str):
            return value
        return value.strip().lower() or None


class TokenOut(CamelModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105 - a scheme name, not a secret
    expires_in: int


class UserOut(CamelModel):
    id: uuid.UUID
    #: None for an account made with a phone number.
    email: EmailStr | None
    name: str = ""
    handle: str | None = None


class AuthOut(CamelModel):
    user: UserOut
    token: TokenOut


class SessionOut(CamelModel):
    """Shaped like ``SessionRecord`` in src/lib/types.ts."""

    id: uuid.UUID
    device: str
    place: str
    when: datetime
    current: bool
