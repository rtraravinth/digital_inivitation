"""Section create, edit, reorder and delete."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Section


async def test_adding_a_section_has_an_empty_title_and_no_kind(auth_client, portfolio):
    """A section has no type. Every one is the same fields underneath."""
    response = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/sections", json={})
    assert response.status_code == 201
    assert response.json()["title"] == ""
    assert "kind" not in response.json()


async def test_adding_a_section_rejects_a_kind(auth_client, portfolio):
    response = await auth_client.post(
        f"/api/v1/portfolios/{portfolio['id']}/sections", json={"kind": "venture"}
    )
    assert response.status_code == 422


async def test_patch_stores_every_optional_extra(auth_client, portfolio):
    section_id = portfolio["sections"][0]["id"]
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section_id}",
        json={
            "title": "Northwell Kitchens",
            "description": "Cloud kitchens in three cities.",
            "tab": "Ventures",
            "links": [{"id": "l1", "label": "Site", "url": "northwell.in"}],
            "quote": {"text": "They shipped fast.", "attribution": "A client"},
            "hidden": True,
        },
    )
    assert response.status_code == 200

    section = response.json()
    assert section["title"] == "Northwell Kitchens"
    assert section["tab"] == "Ventures"
    assert section["quote"]["attribution"] == "A client"
    assert section["hidden"] is True


async def test_a_new_section_starts_on_the_pages_first_tab(auth_client, portfolio):
    """Adding a block must not silently open a tab of its own."""
    first = portfolio["sections"][0]
    assert first["tab"] == "Work"

    await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{first['id']}",
        json={"tab": "Advisory"},
    )
    added = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/sections", json={})

    assert added.status_code == 201
    assert added.json()["tab"] == "Advisory"


@pytest.mark.parametrize("blank", ["", "   "])
async def test_a_section_cannot_be_left_without_a_tab(auth_client, portfolio, blank):
    """A blank tab would take the section off the page altogether."""
    section_id = portfolio["sections"][0]["id"]
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section_id}",
        json={"tab": blank},
    )
    assert response.status_code == 422


async def test_a_tab_is_trimmed(auth_client, portfolio):
    section_id = portfolio["sections"][0]["id"]
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section_id}",
        json={"tab": "  Writing  "},
    )
    assert response.json()["tab"] == "Writing"


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
