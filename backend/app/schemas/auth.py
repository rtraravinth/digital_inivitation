"""Auth request and response bodies."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import EmailStr, Field, field_validator

from app.schemas.common import CamelModel

#: Long enough that a wordlist is useless, short enough to be a passphrase.
PASSWORD_MIN = 12
PASSWORD_MAX = 200


class _EmailNormalising(CamelModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lowercase(cls, value: str) -> str:
        # One address, one account — Rohan@ and rohan@ are the same person.
        return value.strip().lower()


class RegisterRequest(_EmailNormalising):
    password: str = Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)
    name: str = Field(default="", max_length=200)


class LoginRequest(_EmailNormalising):
    password: str = Field(min_length=1, max_length=PASSWORD_MAX)


class TwoStepLoginRequest(CamelModel):
    challenge: str
    code: str = Field(min_length=4, max_length=32)


class ChangePasswordRequest(CamelModel):
    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX)
    new_password: str = Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)


class TokenOut(CamelModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class UserOut(CamelModel):
    id: uuid.UUID
    email: EmailStr
    name: str = ""
    handle: str | None = None
    two_step: bool = False


class AuthOut(CamelModel):
    user: UserOut
    token: TokenOut


class TwoStepRequiredOut(CamelModel):
    two_step_required: Literal[True] = True
    challenge: str


class SessionOut(CamelModel):
    """Shaped like ``SessionRecord`` in src/lib/types.ts."""

    id: uuid.UUID
    device: str
    place: str
    when: datetime
    current: bool


class TwoStepSetupOut(CamelModel):
    secret: str
    otpauth_uri: str


class TwoStepCodeRequest(CamelModel):
    code: str = Field(min_length=4, max_length=32)


class RecoveryCodesOut(CamelModel):
    codes: list[str]
