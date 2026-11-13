"""Settings that must never reach production as they ship."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import DEV_JWT_SECRET, Settings

A_REAL_SECRET = "k" * 43  # the length of a 256-bit secret in base64


def test_production_refuses_the_development_jwt_secret():
    # The default is in this public repository: anyone could sign tokens with it.
    with pytest.raises(ValidationError, match="FACET_JWT_SECRET"):
        Settings(env="prod", jwt_secret=DEV_JWT_SECRET)


def test_production_refuses_a_short_jwt_secret():
    with pytest.raises(ValidationError, match="at least 32"):
        Settings(env="prod", jwt_secret="too-short")


def test_production_accepts_a_real_secret():
    assert Settings(env="prod", jwt_secret=A_REAL_SECRET).jwt_secret == A_REAL_SECRET


@pytest.mark.parametrize("env", ["dev", "test"])
def test_development_keeps_working_with_the_default(env):
    assert Settings(env=env, jwt_secret=DEV_JWT_SECRET).jwt_secret == DEV_JWT_SECRET
