"""Register, sign in, refresh, sign out."""

from __future__ import annotations

from tests.factories import TEST_PASSWORD, bearer


def _replace_refresh_cookie(client, value: str) -> None:
    """Put exactly one refresh cookie in the jar.

    Setting over the top would leave two entries with the same name, and
    which one gets sent is then a coin toss rather than a test.
    """
    client.cookies.clear()
    client.cookies.set("facet_refresh", value, domain="test", path="/api/v1/auth")


async def test_register_returns_a_token_and_creates_the_account(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "New@Example.com",
            "password": TEST_PASSWORD,
            "name": "Rohan Mehta",
            "handle": "rohan-new",
        },
    )
    assert response.status_code == 201

    body = response.json()
    assert body["token"]["accessToken"]
    assert body["token"]["tokenType"] == "bearer"
    assert body["user"]["email"] == "new@example.com"
    assert body["user"]["name"] == "Rohan Mehta"
    assert client.cookies.get("facet_refresh")


async def test_the_refresh_token_is_never_in_the_response_body(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "cookie@example.com",
            "password": TEST_PASSWORD,
            "name": "C",
            "handle": "cookie-person",
        },
    )
    assert "refresh" not in response.text.lower()

    cookie_header = response.headers["set-cookie"].lower()
    assert "httponly" in cookie_header
    assert "samesite=lax" in cookie_header


async def test_register_rejects_a_duplicate_email_with_409(client):
    payload = {
        "email": "dup@example.com",
        "password": TEST_PASSWORD,
        "name": "D",
        "handle": "dup-person",
    }
    assert (await client.post("/api/v1/auth/register", json=payload)).status_code == 201

    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"


async def test_register_is_case_insensitive_about_the_email(client):
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "Case@example.com",
            "password": TEST_PASSWORD,
            "name": "C",
            "handle": "case-one",
        },
    )
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "CASE@EXAMPLE.COM",
            "password": TEST_PASSWORD,
            "name": "C",
            "handle": "case-two",
        },
    )
    assert response.status_code == 409


async def test_register_rejects_a_short_password_with_422(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "x@example.com", "password": "short", "name": "X"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"


async def test_login_with_the_wrong_password_is_401(client, registered):
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": registered["user"]["email"], "password": "nope-not-it"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


async def test_login_for_an_unknown_email_gives_the_same_answer(client):
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "ghost@example.com", "password": TEST_PASSWORD},
    )
    assert response.status_code == 401
    # Identical to a wrong password: the response must not reveal which
    # addresses have accounts.
    assert response.json()["error"]["code"] == "invalid_credentials"


async def test_login_succeeds_and_issues_a_working_token(client, registered):
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": registered["user"]["email"], "password": TEST_PASSWORD},
    )
    assert response.status_code == 200

    token = response.json()["token"]["accessToken"]
    client.headers["Authorization"] = f"Bearer {token}"
    assert (await client.get("/api/v1/auth/sessions")).status_code == 200


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


# ── the handle claimed at sign-up ────────────────────────────────────────
# It is the base of every address the account publishes
# (facet.com/<handle>/<slug>), so it is claimed with the account rather than
# left null until someone visits /account.


async def test_register_stores_the_handle(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "handled@example.com",
            "password": TEST_PASSWORD,
            "name": "H",
            "handle": "aravinth",
        },
    )
    assert response.status_code == 201

    bearer(client, response.json()["token"]["accessToken"])
    assert (await client.get("/api/v1/account")).json()["profile"]["handle"] == "aravinth"


async def test_register_without_a_handle_is_422(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "nohandle@example.com", "password": TEST_PASSWORD, "name": "N"},
    )
    assert response.status_code == 422
    assert "handle" in {f["field"] for f in response.json()["error"]["details"]["fields"]}


async def test_a_handle_is_lowercased_not_rejected(client):
    """"Aravinth" is a typo, not a format error — addresses are lowercase."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "caps@example.com",
            "password": TEST_PASSWORD,
            "name": "C",
            "handle": "  Aravinth  ",
        },
    )
    assert response.status_code == 201

    bearer(client, response.json()["token"]["accessToken"])
    assert (await client.get("/api/v1/account")).json()["profile"]["handle"] == "aravinth"


async def test_a_taken_handle_is_409(client, registered):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "second@example.com",
            "password": TEST_PASSWORD,
            "name": "S",
            "handle": "rohan",
        },
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "handle_taken"


async def test_a_reserved_handle_is_409(client):
    """An app route at that position can never also be somebody's address."""
    for reserved in ("account", "stats", "api", "www", "signin"):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"{reserved}@example.com",
                "password": TEST_PASSWORD,
                "name": "R",
                "handle": reserved,
            },
        )
        assert response.status_code == 409, reserved
        assert response.json()["error"]["code"] == "handle_reserved", reserved


async def test_a_rejected_handle_leaves_no_account_behind(client, registered, db_session):
    """The handle is checked before the user row, not by the unique index."""
    from sqlalchemy import select

    from app.models import User

    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "leftover@example.com",
            "password": TEST_PASSWORD,
            "name": "L",
            "handle": "rohan",
        },
    )
    assert await db_session.scalar(
        select(User).where(User.email == "leftover@example.com")
    ) is None


async def test_a_bad_handle_shape_is_422(client):
    for bad in ("a", "has space", "UPPER-ONLY-!", "-leading", "trailing-"):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "shape@example.com",
                "password": TEST_PASSWORD,
                "name": "S",
                "handle": bad,
            },
        )
        assert response.status_code == 422, bad
