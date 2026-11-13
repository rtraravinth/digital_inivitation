"""Signing in through Firebase, refreshing, signing out.

Firebase is faked here (``fake_verify`` in factories.py) — what is under test
is what FACET does with an identity once Firebase vouches for it. The real
token checks are in test_firebase.py.
"""

from __future__ import annotations

from sqlalchemy import select

from app.models import AccountProfile, AccountSettings, User
from tests.factories import bearer, firebase_token, sign_in


def _replace_refresh_cookie(client, value: str) -> None:
    """Put exactly one refresh cookie in the jar.

    Setting over the top would leave two entries with the same name, and
    which one gets sent is then a coin toss rather than a test.
    """
    client.cookies.clear()
    client.cookies.set("facet_refresh", value, domain="test", path="/api/v1/auth")


# ── a new account ────────────────────────────────────────────────────────


async def test_a_first_sign_in_with_a_handle_creates_the_account(client):
    response = await sign_in(
        client, firebase_token("New@Example.com"), name="Rohan Mehta", handle="rohan-new"
    )
    assert response.status_code == 200

    body = response.json()
    assert body["token"]["accessToken"]
    assert body["token"]["tokenType"] == "bearer"
    assert body["user"]["email"] == "new@example.com"
    assert body["user"]["name"] == "Rohan Mehta"
    assert body["user"]["handle"] == "rohan-new"
    assert client.cookies.get("facet_refresh")


async def test_a_first_sign_in_without_a_handle_asks_for_one(client, db_session):
    response = await sign_in(client, firebase_token("asks@example.com", name="Asha Rao"))
    assert response.status_code == 422

    error = response.json()["error"]
    assert error["code"] == "handle_required"
    # The page pre-fills the name step from what Google or GitHub supplied.
    assert error["details"]["name"] == "Asha Rao"
    assert client.cookies.get("facet_refresh") is None
    assert await db_session.scalar(select(User).where(User.email == "asks@example.com")) is None


async def test_the_name_falls_back_to_the_one_firebase_has(client):
    response = await sign_in(
        client, firebase_token("named@example.com", name="From Google"), handle="named"
    )
    assert response.json()["user"]["name"] == "From Google"


async def test_an_unverified_email_cannot_make_an_account(client, db_session):
    response = await sign_in(
        client, firebase_token("unverified@example.com", verified=False), handle="unverified"
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "email_unverified"
    assert (
        await db_session.scalar(select(User).where(User.email == "unverified@example.com")) is None
    )


async def test_a_phone_account_has_no_email(client):
    token = firebase_token(None, phone="+919845012345", provider="phone")
    response = await sign_in(client, token, name="Phone Person", handle="phone-person")
    assert response.status_code == 200
    assert response.json()["user"]["email"] is None

    bearer(client, response.json()["token"]["accessToken"])
    account = (await client.get("/api/v1/account")).json()
    assert account["security"]["email"] is None
    assert account["security"]["signInProvider"] == "phone"


async def test_the_refresh_token_is_never_in_the_response_body(client):
    response = await sign_in(client, firebase_token("cookie@example.com"), handle="cookie-person")
    assert "refresh" not in response.text.lower()

    cookie_header = response.headers["set-cookie"].lower()
    assert "httponly" in cookie_header
    assert "samesite=lax" in cookie_header


async def test_no_credential_is_stored(client, db_session):
    """Firebase holds every one. The tables have nowhere to put one."""
    await sign_in(client, firebase_token("nothing@example.com"), handle="nothing-held")

    for model in (User, AccountProfile, AccountSettings):
        columns = {column.name for column in model.__table__.columns}
        assert not {c for c in columns if "password" in c or "secret" in c or "two_step" in c}


# ── signing in again ─────────────────────────────────────────────────────


async def test_signing_in_again_finds_the_same_account(client, registered):
    response = await sign_in(client, firebase_token(registered["user"]["email"]))
    assert response.status_code == 200
    assert response.json()["user"]["id"] == registered["user"]["id"]


async def test_a_handle_sent_by_an_existing_account_is_ignored(client, registered):
    response = await sign_in(
        client, firebase_token(registered["user"]["email"]), handle="something-else"
    )
    assert response.json()["user"]["handle"] == "rohan"


async def test_the_uid_wins_over_the_email(client, registered, db_session):
    """Changing the address in Firebase keeps the same FACET account."""
    token = firebase_token("changed@example.com", uid="uid-rohan@example.com")
    response = await sign_in(client, token)
    assert response.json()["user"]["id"] == registered["user"]["id"]


async def test_sign_in_records_the_provider(client, registered):
    response = await sign_in(
        client, firebase_token(registered["user"]["email"], provider="google.com")
    )
    bearer(client, response.json()["token"]["accessToken"])
    security = (await client.get("/api/v1/account")).json()["security"]
    assert security["signInProvider"] == "google.com"
    assert security["google"] is True


async def test_a_closed_account_cannot_sign_in(client, registered_user, db_session):
    registered_user.is_active = False
    await db_session.flush()

    response = await sign_in(client, firebase_token(registered_user.email))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "account_inactive"


async def test_a_token_firebase_did_not_sign_is_401(client):
    response = await sign_in(client, "x" * 40)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_firebase_token"


async def test_a_missing_token_is_422(client):
    response = await client.post("/api/v1/auth/firebase", json={})
    assert response.status_code == 422
    assert "idToken" in {f["field"] for f in response.json()["error"]["details"]["fields"]}


# ── accounts made before Firebase ────────────────────────────────────────


async def _legacy_account(db_session, email: str, handle: str) -> User:
    """An account as the migration leaves it: an address, no Firebase uid."""
    user = User(email=email, is_active=True)
    user.profile = AccountProfile(name="Legacy", handle=handle, tags=[], links=[])
    user.settings = AccountSettings()
    db_session.add(user)
    await db_session.flush()
    return user


async def test_a_verified_email_links_an_existing_account(client, db_session):
    legacy = await _legacy_account(db_session, "legacy@example.com", "legacy")

    response = await sign_in(client, firebase_token("legacy@example.com", uid="firebase-legacy"))
    assert response.status_code == 200
    assert response.json()["user"]["id"] == str(legacy.id)

    await db_session.refresh(legacy)
    assert legacy.firebase_uid == "firebase-legacy"


async def test_an_unverified_email_never_links_an_existing_account(client, db_session):
    """Otherwise anyone could sign up in Firebase with someone else's address."""
    legacy = await _legacy_account(db_session, "victim@example.com", "victim")

    response = await sign_in(
        client, firebase_token("victim@example.com", uid="attacker", verified=False)
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "email_unverified"

    await db_session.refresh(legacy)
    assert legacy.firebase_uid is None


async def test_an_unverified_email_cannot_take_an_address_in_use(client, registered, db_session):
    """An existing Firebase-linked account is not reachable by a new uid either."""
    response = await sign_in(
        client,
        firebase_token(registered["user"]["email"], uid="someone-else", verified=False),
        handle="sneaky",
    )
    assert response.status_code == 403
    user = await db_session.scalar(select(User).where(User.email == registered["user"]["email"]))
    assert user.firebase_uid == f"uid-{registered['user']['email']}"


# ── refresh and sign out ─────────────────────────────────────────────────


async def test_refresh_rotates_the_token_and_the_old_one_stops_working(client, registered):
    first = client.cookies.get("facet_refresh")

    response = await client.post("/api/v1/auth/refresh")
    assert response.status_code == 200
    assert response.json()["token"]["accessToken"]
    assert client.cookies.get("facet_refresh") != first

    _replace_refresh_cookie(client, first)
    reused = await client.post("/api/v1/auth/refresh")
    assert reused.status_code == 401
    assert reused.json()["error"]["code"] == "invalid_refresh_token"


async def test_reusing_a_rotated_token_revokes_every_session(client, registered):
    """A replayed refresh token means it leaked. Drop everything."""
    leaked = client.cookies.get("facet_refresh")
    await client.post("/api/v1/auth/refresh")

    client.headers["Authorization"] = f"Bearer {registered['token']['accessToken']}"
    _replace_refresh_cookie(client, leaked)
    await client.post("/api/v1/auth/refresh")

    # The access token issued before the replay is dead too.
    assert (await client.get("/api/v1/auth/sessions")).status_code == 401


async def test_refresh_without_a_cookie_is_401(client):
    response = await client.post("/api/v1/auth/refresh")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_refresh_token"


async def test_a_protected_route_rejects_a_missing_token(client):
    response = await client.get("/api/v1/auth/sessions")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


async def test_a_protected_route_rejects_a_malformed_header(client):
    client.headers["Authorization"] = "Token abc"
    response = await client.get("/api/v1/auth/sessions")
    assert response.status_code == 401


async def test_logout_revokes_the_session_so_the_access_token_stops_working(auth_client):
    assert (await auth_client.get("/api/v1/auth/sessions")).status_code == 200
    assert (await auth_client.post("/api/v1/auth/logout")).status_code == 204
    assert (await auth_client.get("/api/v1/auth/sessions")).status_code == 401


async def test_the_old_password_routes_are_gone(client):
    for path in (
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/auth/login/two-step",
        "/api/v1/auth/password",
        "/api/v1/auth/two-step/enable",
        "/api/v1/auth/recovery-codes",
    ):
        assert (await client.post(path, json={})).status_code in (404, 405), path


# ── the handle claimed at sign-up ────────────────────────────────────────
# It is the base of every address the account publishes
# (facet.com/<handle>/<slug>), so it is claimed with the account rather than
# left null until someone visits /account.


async def test_a_handle_is_lowercased_not_rejected(client):
    """ "Aravinth" is a typo, not a format error — addresses are lowercase."""
    response = await sign_in(client, firebase_token("caps@example.com"), handle="  Aravinth  ")
    assert response.status_code == 200

    bearer(client, response.json()["token"]["accessToken"])
    assert (await client.get("/api/v1/account")).json()["profile"]["handle"] == "aravinth"


async def test_a_taken_handle_is_409(client, registered):
    response = await sign_in(client, firebase_token("second@example.com"), handle="rohan")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "handle_taken"


async def test_a_reserved_handle_is_409(client):
    """An app route at that position can never also be somebody's address."""
    for reserved in ("account", "stats", "api", "www", "signin"):
        response = await sign_in(client, firebase_token(f"{reserved}@example.com"), handle=reserved)
        assert response.status_code == 409, reserved
        assert response.json()["error"]["code"] == "handle_reserved", reserved


async def test_a_rejected_handle_leaves_no_account_behind(client, registered, db_session):
    """The handle is checked before the user row, not by the unique index."""
    await sign_in(client, firebase_token("leftover@example.com"), handle="rohan")
    assert await db_session.scalar(select(User).where(User.email == "leftover@example.com")) is None


async def test_a_bad_handle_shape_is_422(client):
    for bad in ("a", "has space", "UPPER-ONLY-!", "-leading", "trailing-"):
        response = await sign_in(client, firebase_token("shape@example.com"), handle=bad)
        assert response.status_code == 422, bad
