"""Portfolio CRUD, slugs, publishing, and ownership."""

from __future__ import annotations

from app.models.enums import FONTS


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
    assert body["groundHex"] == ""
    assert body["font"] == "archivo"
    assert body["bodyFont"] == "archivo"
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


async def test_a_taken_slug_is_409_within_one_account(auth_client):
    """Scoped to the owner: the handle in front of it separates accounts."""
    await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "A", "slug": "shared-slug", "startFrom": {"kind": "blank"}},
    )
    response = await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "B", "slug": "shared-slug", "startFrom": {"kind": "blank"}},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "slug_taken"
    assert response.json()["error"]["details"] == {"slug": "shared-slug"}


async def test_the_same_slug_across_accounts_is_fine(auth_client, other_auth_client):
    """facet.page/rohan/investors and facet.page/priya/investors are two pages."""
    for owner in (auth_client, other_auth_client):
        response = await owner.post(
            "/api/v1/portfolios",
            json={"name": "Investors", "slug": "shared-slug",
                  "startFrom": {"kind": "blank"}},
        )
        assert response.status_code == 201, response.text


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


async def test_patch_sets_a_custom_ground_colour(auth_client, portfolio):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"groundHex": "#2b3a67"}
    )
    assert response.status_code == 200

    body = response.json()
    assert body["groundHex"] == "#2b3a67"
    # The preset is an override target, not a replacement: it stays put so
    # clearing the custom colour has somewhere to fall back to.
    assert body["ground"] == "light"


async def test_patch_clears_a_custom_ground_back_to_the_preset(auth_client, portfolio):
    await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"groundHex": "#2b3a67"}
    )
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"groundHex": ""}
    )
    assert response.status_code == 200
    assert response.json()["groundHex"] == ""


async def test_patch_rejects_a_non_hex_ground(auth_client, portfolio):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"groundHex": "rebeccapurple"}
    )
    assert response.status_code == 422


async def test_patch_accepts_every_headline_face(auth_client, portfolio):
    """The check constraint mirrors FONTS, so a face missing from it 500s."""
    for face in FONTS:
        response = await auth_client.patch(
            f"/api/v1/portfolios/{portfolio['id']}", json={"font": face}
        )
        assert response.status_code == 200, f"{face}: {response.text}"
        assert response.json()["font"] == face


async def test_headline_and_body_faces_are_set_apart(auth_client, portfolio):
    """The panel is a pairing, so the two halves must not move together."""
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}",
        json={"font": "playfair-display", "bodyFont": "inter"},
    )
    assert response.status_code == 200

    body = response.json()
    assert body["font"] == "playfair-display"
    assert body["bodyFont"] == "inter"

    # Changing one leaves the other where it was.
    again = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"font": "oswald"}
    )
    assert again.json()["font"] == "oswald"
    assert again.json()["bodyFont"] == "inter"


async def test_body_font_defaults_to_archivo(auth_client, portfolio):
    """Existing portfolios predate the column, so the default has to hold."""
    response = await auth_client.get(f"/api/v1/portfolios/{portfolio['id']}")
    assert response.json()["bodyFont"] == "archivo"


async def test_patch_rejects_an_unknown_body_font(auth_client, portfolio):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"bodyFont": "comic-sans"}
    )
    assert response.status_code == 422


async def test_patch_rejects_an_unknown_font(auth_client, portfolio):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"font": "comic-sans"}
    )
    assert response.status_code == 422


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


async def test_patch_header_stores_the_pages_numbers_and_timeline(auth_client, portfolio):
    """They belong to the page: one "By the numbers" row, one timeline."""
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/header",
        json={
            "numbers": [{"id": "n1", "label": "Cities", "value": "3"}],
            "dates": [{"id": "d1", "year": "2021", "text": "Founded"}],
        },
    )
    assert response.status_code == 200

    header = response.json()["header"]
    assert header["numbers"][0]["value"] == "3"
    assert header["dates"][0]["year"] == "2021"


async def test_a_section_no_longer_carries_numbers_or_a_timeline(auth_client, portfolio):
    section = portfolio["sections"][0]
    assert "numbers" not in section
    assert "dates" not in section

    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section['id']}",
        json={"numbers": [{"id": "n1", "label": "Cities", "value": "3"}]},
    )
    assert response.status_code == 422


async def test_copying_a_portfolio_carries_its_numbers_and_timeline(auth_client, portfolio):
    await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/header",
        json={
            "numbers": [{"id": "n1", "label": "Cities", "value": "3"}],
            "dates": [{"id": "d1", "year": "2021", "text": "Founded"}],
        },
    )

    response = await auth_client.post(
        "/api/v1/portfolios",
        json={
            "name": "Copy",
            "slug": "rohan-copy",
            "startFrom": {"kind": "copy", "id": portfolio["id"]},
        },
    )
    assert response.status_code == 201, response.text

    header = response.json()["header"]
    assert header["numbers"][0]["label"] == "Cities"
    assert header["dates"][0]["text"] == "Founded"


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


async def test_expand_sections_returns_full_documents(auth_client):
    await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "F", "slug": "expanded", "startFrom": {"kind": "founder"}},
    )

    summaries = (await auth_client.get("/api/v1/portfolios")).json()
    assert "sections" not in summaries[0]
    assert summaries[0]["sectionCount"] == 3

    full = (await auth_client.get("/api/v1/portfolios", params={"expand": "sections"})).json()
    assert len(full[0]["sections"]) == 3
    assert full[0]["header"]["name"] == ""


async def test_expand_with_an_unknown_value_is_422(auth_client):
    response = await auth_client.get("/api/v1/portfolios", params={"expand": "everything"})
    assert response.status_code == 422


async def test_expand_only_returns_my_portfolios(auth_client, other_auth_client, portfolio):
    await other_auth_client.post(
        "/api/v1/portfolios",
        json={"name": "T", "slug": "theirs-expand", "startFrom": {"kind": "blank"}},
    )
    full = (await auth_client.get("/api/v1/portfolios", params={"expand": "sections"})).json()
    assert [row["slug"] for row in full] == ["rohan"]


async def test_editing_a_published_portfolio_is_409(auth_client, published):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{published['id']}", json={"name": "Renamed"}
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "portfolio_published"


async def test_editing_a_published_header_is_409(auth_client, published):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{published['id']}/header", json={"name": "Rohan"}
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "portfolio_published"


async def test_deleting_a_published_portfolio_is_409(auth_client, published):
    response = await auth_client.delete(f"/api/v1/portfolios/{published['id']}")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "portfolio_published"
    assert len((await auth_client.get("/api/v1/portfolios")).json()) == 1


async def test_unpublishing_reopens_editing_and_deleting(auth_client, published):
    await auth_client.post(f"/api/v1/portfolios/{published['id']}/unpublish")

    edit = await auth_client.patch(
        f"/api/v1/portfolios/{published['id']}", json={"name": "Renamed"}
    )
    assert edit.status_code == 200
    assert edit.json()["name"] == "Renamed"

    assert (
        await auth_client.delete(f"/api/v1/portfolios/{published['id']}")
    ).status_code == 204


async def test_publishing_an_already_live_portfolio_still_works(auth_client, published):
    again = await auth_client.post(f"/api/v1/portfolios/{published['id']}/publish")
    assert again.status_code == 200
    assert again.json()["status"] == "live"


async def test_publishing_leaves_the_authors_summary_alone(auth_client, portfolio):
    await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}",
        json={"summary": "For investors, and nobody else."},
    )

    live = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/publish")
    assert live.json()["summary"] == "For investors, and nobody else."

    draft = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/unpublish")
    assert draft.json()["summary"] == "For investors, and nobody else."


async def test_a_new_portfolio_has_no_summary(auth_client, portfolio):
    assert portfolio["summary"] == ""


async def test_create_accepts_a_card_note(auth_client):
    response = await auth_client.post(
        "/api/v1/portfolios",
        json={
            "name": "Investor one-pager",
            "slug": "investors-note",
            "summary": "For investors, and nobody else.",
            "startFrom": {"kind": "blank"},
        },
    )
    assert response.status_code == 201
    assert response.json()["summary"] == "For investors, and nobody else."
