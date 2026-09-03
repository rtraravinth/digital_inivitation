"""Two-step verification and recovery codes.

TOTP needs no third party, so unlike billing or SMS this one is genuinely
implemented rather than stored and labelled inert.
"""

from __future__ import annotations

import pyotp
import pytest
from sqlalchemy import select

from app.models import RecoveryCode
from tests.factories import TEST_PASSWORD


@pytest.fixture
async def totp_secret(auth_client) -> str:
    """Two-step turned on for the signed-in user; yields the shared secret."""
    setup = (await auth_client.post("/api/v1/auth/two-step/enable")).json()
    secret = setup["secret"]
    confirm = await auth_client.post(
        "/api/v1/auth/two-step/verify", json={"code": pyotp.TOTP(secret).now()}
    )
    assert confirm.status_code == 204
    return secret


async def _challenge(client, email: str) -> str:
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": TEST_PASSWORD}
    )
    assert response.status_code == 202
    return response.json()["challenge"]


async def test_enabling_two_step_returns_a_secret_and_a_provisioning_uri(auth_client):
    response = await auth_client.post("/api/v1/auth/two-step/enable")
    assert response.status_code == 200

    body = response.json()
    assert body["secret"]
    assert body["otpauthUri"].startswith("otpauth://totp/")
    assert "FACET" in body["otpauthUri"]


async def test_a_wrong_code_does_not_turn_two_step_on(auth_client):
    await auth_client.post("/api/v1/auth/two-step/enable")

    response = await auth_client.post("/api/v1/auth/two-step/verify", json={"code": "000000"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_two_step_code"

    # Still off, so an unconfirmed secret cannot lock anyone out.
    assert (await auth_client.get("/api/v1/account")).json()["security"]["twoStep"] is False


async def test_verifying_without_starting_setup_is_a_conflict(auth_client):
    response = await auth_client.post("/api/v1/auth/two-step/verify", json={"code": "123456"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "two_step_not_started"


async def test_confirming_turns_it_on(auth_client, totp_secret):
    assert (await auth_client.get("/api/v1/account")).json()["security"]["twoStep"] is True


async def test_login_with_two_step_on_returns_202_and_no_session(client, registered, totp_secret):
    client.cookies.clear()
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": registered["user"]["email"], "password": TEST_PASSWORD},
    )
    assert response.status_code == 202
    assert response.json()["twoStepRequired"] is True
    assert response.json()["challenge"]
    # No session exists until the second factor is satisfied.
    assert client.cookies.get("facet_refresh") is None


async def test_completing_the_challenge_issues_a_working_token(client, registered, totp_secret):
    challenge = await _challenge(client, registered["user"]["email"])

    response = await client.post(
        "/api/v1/auth/login/two-step",
        json={"challenge": challenge, "code": pyotp.TOTP(totp_secret).now()},
    )
    assert response.status_code == 200

    token = response.json()["token"]["accessToken"]
    client.headers["Authorization"] = f"Bearer {token}"
    assert (await client.get("/api/v1/auth/sessions")).status_code == 200


async def test_a_wrong_code_does_not_complete_the_challenge(client, registered, totp_secret):
    challenge = await _challenge(client, registered["user"]["email"])

    response = await client.post(
        "/api/v1/auth/login/two-step", json={"challenge": challenge, "code": "000000"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_two_step_code"


async def test_an_access_token_is_not_accepted_as_a_challenge(client, registered, totp_secret):
    response = await client.post(
        "/api/v1/auth/login/two-step",
        json={
            "challenge": registered["token"]["accessToken"],
            "code": pyotp.TOTP(totp_secret).now(),
        },
    )
    assert response.status_code == 401


async def test_recovery_codes_come_back_ten_at_a_time_in_the_documented_shape(
    auth_client, totp_secret
):
    codes = (await auth_client.post("/api/v1/auth/recovery-codes")).json()["codes"]
    assert len(codes) == 10
    assert all(len(code) == 9 and code[4] == "-" for code in codes)
    # The alphabet from generateRecoveryCodes(): no I, O, 0 or 1.
    assert not set("".join(codes)) & set("IO01")


async def test_only_hashes_are_stored(auth_client, db_session, totp_secret):
    codes = (await auth_client.post("/api/v1/auth/recovery-codes")).json()["codes"]

    rows = (await db_session.execute(select(RecoveryCode))).scalars().all()
    stored = {row.code_hash for row in rows}
    assert stored.isdisjoint(set(codes))
    assert all(row.code_hash.startswith("$argon2") for row in rows)


async def test_a_recovery_code_works_once_and_then_does_not(
    client, auth_client, registered, totp_secret
):
    codes = (await auth_client.post("/api/v1/auth/recovery-codes")).json()["codes"]
    email = registered["user"]["email"]

    first = await client.post(
        "/api/v1/auth/login/two-step",
        json={"challenge": await _challenge(client, email), "code": codes[0]},
    )
    assert first.status_code == 200

    second = await client.post(
        "/api/v1/auth/login/two-step",
        json={"challenge": await _challenge(client, email), "code": codes[0]},
    )
    assert second.status_code == 422


async def test_issuing_new_codes_replaces_the_old_ones(client, auth_client, registered, totp_secret):
    stale = (await auth_client.post("/api/v1/auth/recovery-codes")).json()["codes"]
    await auth_client.post("/api/v1/auth/recovery-codes")

    response = await client.post(
        "/api/v1/auth/login/two-step",
        json={
            "challenge": await _challenge(client, registered["user"]["email"]),
            "code": stale[0],
        },
    )
    assert response.status_code == 422


async def test_disabling_two_step_needs_a_code_and_clears_the_codes(
    auth_client, db_session, totp_secret
):
    await auth_client.post("/api/v1/auth/recovery-codes")

    refused = await auth_client.post("/api/v1/auth/two-step/disable", json={"code": "000000"})
    assert refused.status_code == 422

    accepted = await auth_client.post(
        "/api/v1/auth/two-step/disable", json={"code": pyotp.TOTP(totp_secret).now()}
    )
    assert accepted.status_code == 204

    assert (await auth_client.get("/api/v1/account")).json()["security"]["twoStep"] is False
    assert (await db_session.execute(select(RecoveryCode))).scalars().all() == []


async def test_enabling_twice_is_a_conflict(auth_client, totp_secret):
    response = await auth_client.post("/api/v1/auth/two-step/enable")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "two_step_already_enabled"
