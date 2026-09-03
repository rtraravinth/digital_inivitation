"""Portfolio CRUD, slugs, publishing, and ownership."""

from __future__ import annotations


async def test_create_blank_portfolio_starts_with_one_empty_section(auth_client):
    response = await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "Rohan Mehta", "slug": "rohan", "startFrom": {"kind": "blank"}},
    )
    assert response.status_code == 201

    body = response.json()
    assert body["status"] == "empty"
    assert body["theme"] == "editorial"
    assert body["accent"] == "#ec3013"
    assert body["ground"] == "light"
    assert body["font"] == "archivo"
    assert body["layout"] == {
        "roleNav": "tabs",
        "grid": 2,
        "density": "standard",
        "scale": "default",
        "tracking": "-0.015em",
    }
    assert len(body["sections"]) == 1
    assert body["sections"][0]["title"] == ""
    assert body["meta"] == "1 section · just now"


async def test_create_founder_portfolio_seeds_three_titled_sections(auth_client):
    response = await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "F", "slug": "founder-x", "startFrom": {"kind": "founder"}},
    )
    titles = [section["title"] for section in response.json()["sections"]]
    assert titles == ["The company", "What I did before", "How to work with me"]


async def test_create_copy_duplicates_sections_with_new_ids(auth_client):
    source = (
        await auth_client.post(
            "/api/v1/portfolios",
            json={"name": "F", "slug": "src-x", "startFrom": {"kind": "founder"}},
        )
    ).json()

    copy = (
        await auth_client.post(
            "/api/v1/portfolios",
            json={
                "name": "Copy",
                "slug": "copy-x",
                "startFrom": {"kind": "copy", "id": source["id"]},
            },
        )
    ).json()

    assert [s["title"] for s in copy["sections"]] == [s["title"] for s in source["sections"]]
    assert {s["id"] for s in copy["sections"]}.isdisjoint({s["id"] for s in source["sections"]})


async def test_copying_another_users_portfolio_is_404(auth_client, other_auth_client):
    theirs = (
        await other_auth_client.post(
            "/api/v1/portfolios",
            json={"name": "T", "slug": "theirs-copy", "startFrom": {"kind": "founder"}},
        )
    ).json()

    response = await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "Mine", "slug": "mine-copy", "startFrom": {"kind": "copy", "id": theirs["id"]}},
    )
    assert response.status_code == 404


async def test_a_taken_slug_is_409_even_across_users(auth_client, other_auth_client):
    await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "A", "slug": "shared-slug", "startFrom": {"kind": "blank"}},
    )
    response = await other_auth_client.post(
        "/api/v1/portfolios",
        json={"name": "B", "slug": "shared-slug", "startFrom": {"kind": "blank"}},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "slug_taken"
    assert response.json()["error"]["details"] == {"slug": "shared-slug"}


async def test_an_invalid_slug_is_422(auth_client):
    response = await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "A", "slug": "Not A Slug!", "startFrom": {"kind": "blank"}},
    )
    assert response.status_code == 422


async def test_slug_available_reports_both_answers(auth_client, portfolio):
    taken = await auth_client.get("/api/v1/portfolios/slug-available", params={"slug": "rohan"})
    assert taken.json() == {"slug": "rohan", "available": False}

    free = await auth_client.get("/api/v1/portfolios/slug-available", params={"slug": "free-slug"})
    assert free.json()["available"] is True


async def test_list_only_returns_my_portfolios(auth_client, other_auth_client):
    await auth_client.post(
        "/api/v1/portfolios", json={"name": "Mine", "slug": "mine-x", "startFrom": {"kind": "blank"}}
    )
    await other_auth_client.post(
        "/api/v1/portfolios",
        json={"name": "Theirs", "slug": "theirs-x", "startFrom": {"kind": "blank"}},
    )

    rows = (await auth_client.get("/api/v1/portfolios")).json()
    assert [row["name"] for row in rows] == ["Mine"]
    assert rows[0]["sectionCount"] == 1


async def test_reading_another_users_portfolio_is_404_not_403(auth_client, other_auth_client):
    theirs = (
        await other_auth_client.post(
            "/api/v1/portfolios",
            json={"name": "T", "slug": "theirs-y", "startFrom": {"kind": "blank"}},
        )
    ).json()

    response = await auth_client.get(f"/api/v1/portfolios/{theirs['id']}")
    assert response.status_code == 404
    # A 403 here would confirm the id exists.
    assert response.json()["error"]["code"] == "portfolio_not_found"


async def test_patch_updates_theme_accent_and_layout(auth_client, portfolio):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}",
        json={
            "theme": "dossier",
            "accent": "#1d4ed8",
            "ground": "paper",
            "font": "fraunces",
            "layout": {
                "roleNav": "lens",
                "grid": 3,
                "density": "dense",
                "scale": "display",
                "tracking": "-0.02em",
            },
        },
    )
    assert response.status_code == 200

    body = response.json()
    assert body["theme"] == "dossier"
    assert body["accent"] == "#1d4ed8"
    assert body["ground"] == "paper"
    assert body["font"] == "fraunces"
    assert body["layout"]["grid"] == 3
    assert body["layout"]["roleNav"] == "lens"


async def test_patch_rejects_an_unknown_theme(auth_client, portfolio):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"theme": "vaporwave"}
    )
    assert response.status_code == 422


async def test_patch_rejects_a_non_hex_accent(auth_client, portfolio):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"accent": "rebeccapurple"}
    )
    assert response.status_code == 422


async def test_patch_rejects_an_unknown_field(auth_client, portfolio):
    """A typo must fail loudly, not look like a save that did nothing."""
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"thmee": "poster"}
    )
    assert response.status_code == 422


async def test_changing_a_slug_to_a_taken_one_is_409(auth_client, portfolio):
    await auth_client.post(
        "/api/v1/portfolios", json={"name": "Other", "slug": "other-x", "startFrom": {"kind": "blank"}}
    )
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"slug": "other-x"}
    )
    assert response.status_code == 409


async def test_keeping_your_own_slug_is_not_a_conflict(auth_client, portfolio):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"slug": "rohan", "name": "Renamed"}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"


async def test_patch_header_stores_tags_and_links(auth_client, portfolio):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/header",
        json={
            "name": "Rohan Mehta",
            "current": "Founder, Northwell Kitchens",
            "description": "I run two businesses and advise sixty households.",
            "tags": ["Founder", "Adviser"],
            "links": [{"id": "l1", "label": "Email", "url": "rohan@northwell.in"}],
        },
    )
    assert response.status_code == 200

    header = response.json()["header"]
    assert header["name"] == "Rohan Mehta"
    assert header["tags"] == ["Founder", "Adviser"]
    assert header["links"][0]["label"] == "Email"


async def test_publish_sets_status_live_and_unpublish_sets_draft(auth_client, portfolio):
    up = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/publish")
    assert up.json()["status"] == "live"
    assert up.json()["publishedAt"] is not None

    down = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/unpublish")
    assert down.json()["status"] == "draft"
    assert down.json()["publishedAt"] is None


async def test_delete_removes_it_from_the_list(auth_client, portfolio):
    assert (await auth_client.delete(f"/api/v1/portfolios/{portfolio['id']}")).status_code == 204
    assert (await auth_client.get("/api/v1/portfolios")).json() == []


async def test_deleting_another_users_portfolio_is_404(auth_client, other_auth_client):
    theirs = (
        await other_auth_client.post(
            "/api/v1/portfolios",
            json={"name": "T", "slug": "theirs-del", "startFrom": {"kind": "blank"}},
        )
    ).json()

    assert (await auth_client.delete(f"/api/v1/portfolios/{theirs['id']}")).status_code == 404
    assert len((await other_auth_client.get("/api/v1/portfolios")).json()) == 1


async def test_every_route_requires_a_token(client, portfolio):
    client.headers.pop("Authorization", None)
    assert (await client.get("/api/v1/portfolios")).status_code == 401
    assert (await client.get(f"/api/v1/portfolios/{portfolio['id']}")).status_code == 401
