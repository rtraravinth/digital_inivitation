"""The app itself: health, and the one error envelope."""

from __future__ import annotations


async def test_health_returns_ok(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_unknown_route_uses_the_error_envelope(client):
    response = await client.get("/api/v1/nope")
    assert response.status_code == 404

    body = response.json()
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "details", "request_id"}
    assert body["error"]["code"] == "not_found"
    assert response.headers["X-Request-ID"] == body["error"]["request_id"]


async def test_a_supplied_request_id_is_echoed_back(client):
    response = await client.get("/health", headers={"X-Request-ID": "given-by-the-caller"})
    assert response.headers["X-Request-ID"] == "given-by-the-caller"


async def test_validation_failure_names_the_field(client):
    response = await client.post("/api/v1/auth/register", json={"email": "not-an-email"})
    assert response.status_code == 422

    error = response.json()["error"]
    assert error["code"] == "validation_failed"
    fields = {item["field"] for item in error["details"]["fields"]}
    assert "email" in fields
    assert "password" in fields


async def test_field_messages_are_written_for_a_person(client):
    """The UI prints these next to the field, so they cannot be pydantic's.

    "value is not a valid email address: An email address must have an
    @-sign." is a developer's sentence; the envelope promises a person's.
    """
    response = await client.post("/api/v1/auth/register", json={"email": "not-an-email"})
    messages = {item["field"]: item["message"] for item in response.json()["error"]["details"]["fields"]}

    assert messages["email"] == "Enter an email address in the form name@example.com."
    assert messages["password"] == "This is required."
    for message in messages.values():
        assert not message.startswith("value is not")
        assert not message.startswith("Value error,")


async def test_an_unknown_field_says_so_plainly(auth_client, portfolio):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/header", json={"role": "Tester"}
    )
    assert response.status_code == 422
    message = response.json()["error"]["details"]["fields"][0]["message"]
    assert message == "That is not a field this accepts."


async def test_a_validator_keeps_its_own_wording(auth_client):
    """Messages written in app/schemas are already for a person — keep them."""
    response = await auth_client.post(
        "/api/v1/portfolios", json={"name": "X", "slug": "Not A Slug!", "startFrom": {"kind": "blank"}}
    )
    assert response.status_code == 422
    message = response.json()["error"]["details"]["fields"][0]["message"]
    assert not message.startswith("Value error,")
    assert message


async def test_a_401_carries_the_authenticate_header(client):
    response = await client.get("/api/v1/auth/sessions")
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_app_error_subclasses_carry_their_status_and_code():
    from app.core.errors import Conflict, NotFound, PayloadTooLarge

    conflict = Conflict("taken", details={"slug": "rohan"})
    assert (conflict.status_code, conflict.code) == (409, "conflict")
    assert conflict.details == {"slug": "rohan"}

    assert NotFound("gone").status_code == 404
    assert PayloadTooLarge("big").code == "payload_too_large"
