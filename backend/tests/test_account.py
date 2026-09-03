"""The /account surface."""

from __future__ import annotations

from sqlalchemy import func, select

from app.models import Portfolio, User


async def test_get_account_returns_the_ui_shape_in_camel_case(auth_client):
    body = (await auth_client.get("/api/v1/account")).json()

    assert set(body) == {
        "profile", "security", "plan", "customDomain", "notifications", "privacy"
    }
    assert set(body["notifications"]) == {
        "booking", "weekly", "brokenLink", "mention", "product"
    }
    assert set(body["privacy"]) == {"indexable", "showContact", "countVisits", "badge"}
    assert set(body["profile"]) == {
        "name", "handle", "current", "about", "tags", "links", "portrait"
    }


async def test_the_defaults_match_the_frontends(auth_client):
    body = (await auth_client.get("/api/v1/account")).json()

    assert body["plan"] == "free"
    assert body["customDomain"] == ""
    assert body["notifications"] == {
        "booking": True, "weekly": True, "brokenLink": True,
        "mention": False, "product": False,
    }
    # All four start permissive, and all four actually change what renders.
    assert body["privacy"] == {
        "indexable": True, "showContact": True, "countVisits": True, "badge": True
    }


async def test_account_never_leaks_a_secret_or_a_hash(auth_client):
    await auth_client.post("/api/v1/auth/two-step/enable")

    blob = (await auth_client.get("/api/v1/account")).text.lower()
    assert "secret" not in blob
    assert "hash" not in blob
    assert "$argon2" not in blob


async def test_patch_profile_stores_name_tags_and_links(auth_client):
    response = await auth_client.patch(
        "/api/v1/account/profile",
        json={
            "name": "Rohan Mehta",
            "current": "Founder, Northwell Kitchens",
            "about": "I run two businesses.",
            "tags": ["Founder", "Financial adviser", "Writer"],
            "links": [{"id": "al1", "label": "Email", "url": "rohan@northwell.in"}],
        },
    )
    assert response.status_code == 200

    profile = response.json()["profile"]
    assert profile["tags"] == ["Founder", "Financial adviser", "Writer"]
    assert profile["links"][0]["url"] == "rohan@northwell.in"


async def test_handle_is_unique_across_users(auth_client, other_auth_client):
    assert (
        await auth_client.patch("/api/v1/account/profile", json={"handle": "rohan"})
    ).status_code == 200

    response = await other_auth_client.patch(
        "/api/v1/account/profile", json={"handle": "rohan"}
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "handle_taken"


async def test_keeping_your_own_handle_is_not_a_conflict(auth_client):
    await auth_client.patch("/api/v1/account/profile", json={"handle": "rohan"})
    response = await auth_client.patch(
        "/api/v1/account/profile", json={"handle": "rohan", "name": "Renamed"}
    )
    assert response.status_code == 200
    assert response.json()["profile"]["name"] == "Renamed"


async def test_an_invalid_handle_is_422(auth_client):
    response = await auth_client.patch(
        "/api/v1/account/profile", json={"handle": "Not A Handle"}
    )
    assert response.status_code == 422


async def test_patch_privacy_persists_one_key_without_clearing_the_others(auth_client):
    response = await auth_client.patch("/api/v1/account/privacy", json={"indexable": False})
    assert response.status_code == 200

    privacy = response.json()["privacy"]
    assert privacy["indexable"] is False
    assert privacy["badge"] is True
    assert privacy["showContact"] is True
    assert privacy["countVisits"] is True


async def test_privacy_survives_a_reread(auth_client):
    await auth_client.patch("/api/v1/account/privacy", json={"badge": False})
    assert (await auth_client.get("/api/v1/account")).json()["privacy"]["badge"] is False


async def test_patch_privacy_rejects_an_unknown_key(auth_client):
    response = await auth_client.patch("/api/v1/account/privacy", json={"nonsense": True})
    assert response.status_code == 422


async def test_patch_notifications_merges(auth_client):
    response = await auth_client.patch(
        "/api/v1/account/notifications", json={"mention": True, "weekly": False}
    )
    notifications = response.json()["notifications"]
    assert notifications["mention"] is True
    assert notifications["weekly"] is False
    assert notifications["booking"] is True


async def test_setting_the_plan_works_and_an_unknown_plan_is_422(auth_client):
    assert (
        await auth_client.patch("/api/v1/account/plan", json={"plan": "pro"})
    ).json()["plan"] == "pro"

    response = await auth_client.patch("/api/v1/account/plan", json={"plan": "enterprise"})
    assert response.status_code == 422


async def test_a_custom_domain_is_tidied_before_storing(auth_client):
    response = await auth_client.patch(
        "/api/v1/account/domain", json={"customDomain": "https://Rohan.Example.com/"}
    )
    assert response.json()["customDomain"] == "rohan.example.com"


async def test_security_patch_updates_phone_but_not_email(auth_client):
    response = await auth_client.patch("/api/v1/account/security", json={"phone": "+91 98450"})
    assert response.json()["security"]["phone"] == "+91 98450"

    # Email is identity, not a preference: it is not patchable here.
    refused = await auth_client.patch(
        "/api/v1/account/security", json={"email": "new@example.com"}
    )
    assert refused.status_code == 422


async def test_recovery_codes_remaining_is_reported(auth_client):
    assert (await auth_client.get("/api/v1/account")).json()["security"][
        "recoveryCodesRemaining"
    ] == 0

    await auth_client.post("/api/v1/auth/recovery-codes")
    assert (await auth_client.get("/api/v1/account")).json()["security"][
        "recoveryCodesRemaining"
    ] == 10


async def test_account_requires_a_token(client):
    client.headers.pop("Authorization", None)
    assert (await client.get("/api/v1/account")).status_code == 401


async def test_delete_account_removes_the_user_and_everything_under_it(
    auth_client, other_auth_client, db_session
):
    await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "P", "slug": "delete-me", "startFrom": {"kind": "founder"}},
    )

    assert (await auth_client.delete("/api/v1/account")).status_code == 204

    # The other account is untouched.
    users = (await db_session.execute(select(func.count()).select_from(User))).scalar_one()
    assert users == 1

    portfolios = (
        await db_session.execute(select(func.count()).select_from(Portfolio))
    ).scalar_one()
    assert portfolios == 0

    assert (await other_auth_client.get("/api/v1/account")).status_code == 200
