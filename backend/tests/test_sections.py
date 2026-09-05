"""Section create, edit, reorder and delete."""

from __future__ import annotations

from sqlalchemy import select

from app.models import Section


async def test_adding_a_block_seeds_the_kinds_title(auth_client, portfolio):
    response = await auth_client.post(
        f"/api/v1/portfolios/{portfolio['id']}/sections", json={"kind": "venture"}
    )
    assert response.status_code == 201
    assert response.json()["kind"] == "venture"
    assert response.json()["title"] == "A business you run"


async def test_every_block_kind_is_accepted(auth_client, portfolio):
    kinds = ["link", "venture", "contact", "booking",
             "testimonial", "gallery", "numbers", "document"]
    for kind in kinds:
        response = await auth_client.post(
            f"/api/v1/portfolios/{portfolio['id']}/sections", json={"kind": kind}
        )
        assert response.status_code == 201, kind
        assert response.json()["kind"] == kind


async def test_adding_a_plain_section_has_an_empty_title(auth_client, portfolio):
    response = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/sections", json={})
    assert response.json()["title"] == ""
    assert response.json()["kind"] == "link"


async def test_an_unknown_kind_is_422(auth_client, portfolio):
    response = await auth_client.post(
        f"/api/v1/portfolios/{portfolio['id']}/sections", json={"kind": "podcast"}
    )
    assert response.status_code == 422


async def test_patch_stores_every_optional_extra(auth_client, portfolio):
    section_id = portfolio["sections"][0]["id"]
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section_id}",
        json={
            "title": "Northwell Kitchens",
            "description": "Cloud kitchens in three cities.",
            "tags": ["Food", "Ops"],
            "links": [{"id": "l1", "label": "Site", "url": "northwell.in"}],
            "numbers": [{"id": "n1", "label": "Cities", "value": "3"}],
            "dates": [{"id": "d1", "year": "2021", "text": "Founded"}],
            "quote": {"text": "They shipped fast.", "attribution": "A client"},
            "hidden": True,
        },
    )
    assert response.status_code == 200

    section = response.json()
    assert section["title"] == "Northwell Kitchens"
    assert section["tags"] == ["Food", "Ops"]
    assert section["numbers"][0]["value"] == "3"
    assert section["dates"][0]["year"] == "2021"
    assert section["quote"]["attribution"] == "A client"
    assert section["hidden"] is True


async def test_an_absent_quote_is_left_alone_and_null_clears_it(auth_client, portfolio):
    section_id = portfolio["sections"][0]["id"]
    url = f"/api/v1/portfolios/{portfolio['id']}/sections/{section_id}"

    await auth_client.patch(url, json={"quote": {"text": "x", "attribution": "y"}})

    # Absent: untouched.
    kept = await auth_client.patch(url, json={"title": "Still here"})
    assert kept.json()["quote"]["text"] == "x"

    # Explicit null: cleared.
    cleared = await auth_client.patch(url, json={"quote": None})
    assert cleared.json()["quote"] is None


async def test_patch_rejects_an_unknown_field(auth_client, portfolio):
    section_id = portfolio["sections"][0]["id"]
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section_id}", json={"titel": "typo"}
    )
    assert response.status_code == 422


async def test_move_reorders_and_clamps_at_the_ends(auth_client, three_sections):
    portfolio_id, ids = three_sections

    moved = await auth_client.post(
        f"/api/v1/portfolios/{portfolio_id}/sections/{ids[2]}/move", json={"delta": -1}
    )
    assert moved.status_code == 200
    assert [s["id"] for s in moved.json()["sections"]] == [ids[0], ids[2], ids[1]]

    # At the top, up does nothing — that is not a client error.
    clamped = await auth_client.post(
        f"/api/v1/portfolios/{portfolio_id}/sections/{ids[0]}/move", json={"delta": -1}
    )
    assert clamped.status_code == 200
    assert [s["id"] for s in clamped.json()["sections"]] == [ids[0], ids[2], ids[1]]


async def test_move_down_works_too(auth_client, three_sections):
    portfolio_id, ids = three_sections
    response = await auth_client.post(
        f"/api/v1/portfolios/{portfolio_id}/sections/{ids[0]}/move", json={"delta": 1}
    )
    assert [s["id"] for s in response.json()["sections"]] == [ids[1], ids[0], ids[2]]


async def test_move_rejects_a_delta_that_is_not_one_step(auth_client, three_sections):
    portfolio_id, ids = three_sections
    response = await auth_client.post(
        f"/api/v1/portfolios/{portfolio_id}/sections/{ids[0]}/move", json={"delta": 5}
    )
    assert response.status_code == 422


async def test_reorder_accepts_a_full_id_list(auth_client, three_sections):
    portfolio_id, ids = three_sections
    response = await auth_client.put(
        f"/api/v1/portfolios/{portfolio_id}/sections/order",
        json={"ids": [ids[2], ids[0], ids[1]]},
    )
    assert response.status_code == 200
    assert [s["id"] for s in response.json()["sections"]] == [ids[2], ids[0], ids[1]]


async def test_reorder_rejects_a_partial_list(auth_client, three_sections):
    portfolio_id, ids = three_sections
    response = await auth_client.put(
        f"/api/v1/portfolios/{portfolio_id}/sections/order", json={"ids": [ids[0]]}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "section_order_mismatch"


async def test_delete_leaves_positions_dense(auth_client, three_sections, db_session):
    portfolio_id, ids = three_sections

    assert (
        await auth_client.delete(f"/api/v1/portfolios/{portfolio_id}/sections/{ids[0]}")
    ).status_code == 204

    rows = (
        await db_session.execute(
            select(Section).where(Section.portfolio_id == portfolio_id).order_by(Section.position)
        )
    ).scalars().all()
    assert [row.position for row in rows] == [0, 1]
    assert [str(row.id) for row in rows] == [ids[1], ids[2]]


async def test_deleting_a_section_that_does_not_exist_is_404(auth_client, portfolio):
    missing = "01a00000-0000-7000-8000-000000000000"
    response = await auth_client.delete(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{missing}"
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "section_not_found"


async def test_touching_a_section_of_another_users_portfolio_is_404(
    auth_client, other_auth_client
):
    theirs = (
        await other_auth_client.post(
            "/api/v1/portfolios",
            json={"name": "T", "slug": "theirs-sec", "startFrom": {"kind": "blank"}},
        )
    ).json()
    section_id = theirs["sections"][0]["id"]

    response = await auth_client.patch(
        f"/api/v1/portfolios/{theirs['id']}/sections/{section_id}", json={"title": "hijack"}
    )
    assert response.status_code == 404

    # Untouched.
    still = (await other_auth_client.get(f"/api/v1/portfolios/{theirs['id']}")).json()
    assert still["sections"][0]["title"] == ""


async def test_a_section_id_from_another_portfolio_is_404(auth_client, portfolio):
    other = (
        await auth_client.post(
            "/api/v1/portfolios",
            json={"name": "Other", "slug": "other-sec", "startFrom": {"kind": "blank"}},
        )
    ).json()
    foreign_section = other["sections"][0]["id"]

    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{foreign_section}",
        json={"title": "wrong parent"},
    )
    assert response.status_code == 404
