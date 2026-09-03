"""Password hashing and token encoding."""

from __future__ import annotations

import pytest

from app.core import security as sec
from app.core.errors import Unauthenticated


def test_hash_then_verify_roundtrips():
    hashed = sec.hash_password("correct horse battery")
    assert hashed != "correct horse battery"
    assert sec.verify_password("correct horse battery", hashed)
    assert not sec.verify_password("wrong", hashed)


def test_verify_password_is_false_on_garbage_not_an_exception():
    assert sec.verify_password("x", "not-a-hash") is False


def test_two_hashes_of_the_same_password_differ():
    assert sec.hash_password("same") != sec.hash_password("same")


def test_access_token_roundtrips_subject_and_session():
    token = sec.create_access_token("user-1", session_id="sess-1")
    claims = sec.decode_access_token(token)
    assert claims.sub == "user-1"
    assert claims.sid == "sess-1"


def test_decode_rejects_a_tampered_token():
    token = sec.create_access_token("user-1", session_id="sess-1")
    with pytest.raises(Unauthenticated):
        sec.decode_access_token(token[:-2] + "xy")


def test_a_challenge_token_is_not_accepted_as_an_access_token():
    challenge = sec.create_challenge_token("user-1")
    with pytest.raises(Unauthenticated) as caught:
        sec.decode_access_token(challenge)
    assert caught.value.code == "invalid_token"


def test_an_access_token_is_not_accepted_as_a_challenge():
    token = sec.create_access_token("user-1", session_id="sess-1")
    with pytest.raises(Unauthenticated):
        sec.decode_challenge_token(token)


def test_refresh_token_returns_plaintext_and_a_matching_hash():
    plaintext, hashed = sec.new_refresh_token()
    assert plaintext != hashed
    assert sec.hash_token(plaintext) == hashed
    assert len(hashed) == 64


def test_refresh_tokens_are_unique():
    assert sec.new_refresh_token()[0] != sec.new_refresh_token()[0]
