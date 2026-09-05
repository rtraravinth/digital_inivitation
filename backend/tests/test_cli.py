"""The development commands.

The seed itself is exercised in test_seed_and_slugs.py, which imports the same
fixture through the API. What matters here is that the CLI cannot create an
account the API would then refuse to sign in.
"""

from __future__ import annotations

import pytest
import typer

from app.cli import create_user


def test_create_user_rejects_an_email_the_api_would_refuse():
    # A reserved TLD gets past a naive "has an @ in it" check and is then
    # rejected at login, leaving an account nobody can use.
    with pytest.raises(typer.BadParameter):
        create_user(email="demo@facet.test", password="correct horse battery", name="R")


def test_create_user_rejects_a_short_password():
    with pytest.raises(typer.BadParameter):
        create_user(email="someone@example.com", password="short", name="R")


def test_create_user_rejects_a_malformed_address():
    with pytest.raises(typer.BadParameter):
        create_user(email="not-an-email", password="correct horse battery", name="R")
