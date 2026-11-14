"""The real Firebase ID token checks, against a key pair made for the test.

Google's keys are swapped for one generated here, so every check runs as it
would in production: signature, algorithm, audience, issuer, expiry and how
long ago the person signed in.
"""

from __future__ import annotations

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core import firebase
from app.core.config import get_settings
from app.core.errors import Unauthenticated

PROJECT = "facet-test-project"


@pytest.fixture
def keys(monkeypatch):
    """A signing key, served the way PyJWKClient would serve Google's."""
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = private.public_key()

    class _Key:
        key = public
        key_id = "test"  # the kid the test tokens name

    class _Client:
        def get_signing_keys(self, refresh=False):
            return [_Key()]

    monkeypatch.setattr(firebase, "_jwks_client", lambda: _Client())
    monkeypatch.setenv("FACET_FIREBASE_PROJECT_ID", PROJECT)
    get_settings.cache_clear()
    yield private
    get_settings.cache_clear()


def _claims(**overrides) -> dict:
    now = int(time.time())
    claims = {
        "iss": f"https://securetoken.google.com/{PROJECT}",
        "aud": PROJECT,
        "sub": "firebase-uid-1",
        "iat": now,
        "exp": now + 3600,
        "auth_time": now - 30,
        "email": "Someone@Example.com",
        "email_verified": True,
        "name": "Some One",
        "firebase": {"sign_in_provider": "password"},
    }
    claims.update(overrides)
    return {key: value for key, value in claims.items() if value is not None}


def _sign(private, claims: dict, algorithm: str = "RS256") -> str:
    return jwt.encode(claims, private, algorithm=algorithm, headers={"kid": "test"})


async def test_a_good_token_gives_the_identity(keys):
    identity = await firebase.verify_id_token(_sign(keys, _claims()))
    assert identity.uid == "firebase-uid-1"
    assert identity.email == "someone@example.com"
    assert identity.email_verified is True
    assert identity.name == "Some One"
    assert identity.provider == "password"
    assert abs(identity.auth_time.timestamp() - (time.time() - 30)) < 5


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "someone-elses-project"},
        {"iss": "https://securetoken.google.com/someone-elses-project"},
        {"exp": int(time.time()) - 3600, "iat": int(time.time()) - 7200},
        {"sub": ""},
        {"auth_time": int(time.time()) + 3600},
        {"firebase": {"sign_in_provider": "anonymous"}},
        {"firebase": {"sign_in_provider": "custom"}},
    ],
)
async def test_a_bad_claim_is_refused(keys, overrides):
    with pytest.raises(Unauthenticated) as caught:
        await firebase.verify_id_token(_sign(keys, _claims(**overrides)))
    assert caught.value.code == "invalid_firebase_token"


async def test_a_missing_auth_time_is_refused(keys):
    claims = _claims()
    del claims["auth_time"]
    with pytest.raises(Unauthenticated):
        await firebase.verify_id_token(_sign(keys, claims))


async def test_an_old_sign_in_is_refused_however_fresh_the_token(keys):
    """An hour-old ID token is not traded for a 30-day session."""
    stale = _claims(auth_time=int(time.time()) - 60 * 60)
    with pytest.raises(Unauthenticated) as caught:
        await firebase.verify_id_token(_sign(keys, stale))
    assert caught.value.code == "firebase_sign_in_stale"


async def test_a_token_signed_by_another_key_is_refused(keys):
    stranger = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with pytest.raises(Unauthenticated) as caught:
        await firebase.verify_id_token(_sign(stranger, _claims()))
    assert caught.value.code == "invalid_firebase_token"


async def test_a_symmetric_token_is_refused(keys):
    """RS256 only — an HS256 token must never be checked against a public key."""
    token = jwt.encode(_claims(), "a-shared-secret-of-sufficient-length!", algorithm="HS256")
    with pytest.raises(Unauthenticated):
        await firebase.verify_id_token(token)


async def test_an_unverified_email_is_reported_not_trusted(keys):
    identity = await firebase.verify_id_token(_sign(keys, _claims(email_verified=False)))
    assert identity.email_verified is False


async def test_nothing_is_accepted_without_a_project_id(keys, monkeypatch):
    monkeypatch.setenv("FACET_FIREBASE_PROJECT_ID", "")
    get_settings.cache_clear()
    with pytest.raises(Unauthenticated) as caught:
        await firebase.verify_id_token(_sign(keys, _claims()))
    assert caught.value.code == "firebase_not_configured"
