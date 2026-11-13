"""Devices signed in.

These are the /account controls that used to render a notice saying they
needed a server. They now do what they say.
"""

from __future__ import annotations


async def test_sessions_lists_the_current_one_marked_current(auth_client):
    response = await auth_client.get("/api/v1/auth/sessions")
    assert response.status_code == 200

    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["current"] is True
    assert rows[0]["device"] == "Chrome on Mac"


async def test_a_second_login_appears_as_a_second_session(auth_client, second_login):
    rows = (await auth_client.get("/api/v1/auth/sessions")).json()
    assert len(rows) == 2
    assert [row["current"] for row in rows].count(True) == 1
    assert {row["device"] for row in rows} == {"Chrome on Mac", "Safari on iPhone"}


async def test_the_callers_own_device_sorts_first(auth_client, second_login):
    rows = (await auth_client.get("/api/v1/auth/sessions")).json()
    assert rows[0]["current"] is True


async def test_revoking_the_other_session_kills_its_access_token(auth_client, second_login):
    rows = (await auth_client.get("/api/v1/auth/sessions")).json()
    other = next(row for row in rows if not row["current"])

    response = await auth_client.delete(f"/api/v1/auth/sessions/{other['id']}")
    assert response.status_code == 204

    # Revoking has to take effect now, not when the access token expires.
    assert (await second_login.get("/api/v1/auth/sessions")).status_code == 401
    assert (await auth_client.get("/api/v1/auth/sessions")).status_code == 200


async def test_revoking_the_same_session_twice_is_404(auth_client, second_login):
    rows = (await auth_client.get("/api/v1/auth/sessions")).json()
    other = next(row for row in rows if not row["current"])

    await auth_client.delete(f"/api/v1/auth/sessions/{other['id']}")
    repeat = await auth_client.delete(f"/api/v1/auth/sessions/{other['id']}")
    assert repeat.status_code == 404
    assert repeat.json()["error"]["code"] == "session_not_found"


async def test_revoking_another_users_session_is_404_not_403(auth_client, other_auth_client):
    theirs = (await other_auth_client.get("/api/v1/auth/sessions")).json()[0]

    response = await auth_client.delete(f"/api/v1/auth/sessions/{theirs['id']}")
    assert response.status_code == 404
    # Still signed in: the request touched nothing.
    assert (await other_auth_client.get("/api/v1/auth/sessions")).status_code == 200


async def test_revoke_all_others_keeps_the_caller_signed_in(auth_client, second_login):
    response = await auth_client.delete("/api/v1/auth/sessions")
    assert response.status_code == 200
    assert response.json() == {"revoked": 1}

    assert (await auth_client.get("/api/v1/auth/sessions")).status_code == 200
    assert (await second_login.get("/api/v1/auth/sessions")).status_code == 401
