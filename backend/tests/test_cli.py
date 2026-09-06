"""The development commands.

The seed itself is exercised in test_seed_and_slugs.py, which imports the same
fixture through the API. What matters here is that the CLI cannot create an
account the API would then refuse to sign in.
"""

from __future__ import annotations

import pytest
import typer

import app.cli
from app.cli import create_user

VALID = {"email": "someone@example.com", "password": "correct horse battery", "handle": "someone"}


def test_create_user_rejects_an_email_the_api_would_refuse():
    # A reserved TLD gets past a naive "has an @ in it" check and is then
    # rejected at login, leaving an account nobody can use.
    with pytest.raises(typer.BadParameter):
        create_user(**{**VALID, "email": "demo@facet.test"}, name="R")


def test_create_user_rejects_a_short_password():
    with pytest.raises(typer.BadParameter):
        create_user(**{**VALID, "password": "short"}, name="R")


def test_create_user_rejects_a_malformed_address():
    with pytest.raises(typer.BadParameter):
        create_user(**{**VALID, "email": "not-an-email"}, name="R")


def test_create_user_rejects_a_malformed_handle():
    with pytest.raises(typer.BadParameter):
        create_user(**{**VALID, "handle": "Not A Handle"}, name="R")


def test_create_user_passes_validation_and_forwards_the_handle(monkeypatch):
    """The regression the other tests could not see.

    They all assert BadParameter, and for a while every call raised it: the
    command validated through RegisterRequest, which requires a handle, and
    never sent one. A valid call has to get past validation and reach the
    write — with the handle, or the account has no address to publish under.
    """
    seen = {}

    async def fake_create(email, password, name, handle):
        seen.update(email=email, name=name, handle=handle)
        return "an-id"

    monkeypatch.setattr(app.cli, "_create_user", fake_create)
    monkeypatch.setattr(app.cli, "_run", lambda coro: __import__("asyncio").run(coro))

    create_user(**VALID, name="R")

    assert seen == {"email": "someone@example.com", "name": "R", "handle": "someone"}
