"""Addresses, and the seeded content importing cleanly.

An address is ``facet.page/<handle>/<slug>``. The handle in front is what
makes it unique, so a slug is one segment and only has to be free within the
account that owns it — two people can both publish "investors".
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tests.factories import OTHER_HANDLE, TEST_HANDLE

SEED_FILE = Path(__file__).resolve().parents[1] / "app" / "seed_data.json"


def seed_payload() -> list[dict]:
    return json.loads(SEED_FILE.read_text(encoding="utf-8"))


def test_the_seed_fixture_exists_and_holds_the_five_portfolios():
    payload = seed_payload()
    assert len(payload) == 5
    assert {p["slug"] for p in payload} == {
        "full",
        "investors",
        "advisory",
        "writing",
        "board",
    }


@pytest.mark.parametrize("slug", ["full", "investors", "a-b-c", "x2"])
async def test_a_single_segment_slug_is_accepted(auth_client, slug):
    response = await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "N", "slug": slug, "startFrom": {"kind": "blank"}},
    )
    assert response.status_code == 201, response.text
    assert response.json()["slug"] == slug


@pytest.mark.parametrize(
    "slug",
    [
        "Not A Slug!",
        "/leading",
        "trailing/",
        "double//slash",
        "-hyphen",
        "up/../out",
        # Nesting is gone: the handle is the namespace now.
        "rohan/investors",
        "a-b/c-d/e-f",
    ],
)
async def test_a_malformed_slug_is_422(auth_client, slug):
    response = await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "N", "slug": slug, "startFrom": {"kind": "blank"}},
    )
    assert response.status_code == 422


async def test_two_accounts_can_hold_the_same_slug(auth_client, other_auth_client, client):
    """The whole point of the handle being in the address."""
    for owner in (auth_client, other_auth_client):
        created = (
            await owner.post(
                "/api/v1/portfolios",
                json={"name": "Investors", "slug": "investors",
                      "startFrom": {"kind": "blank"}},
            )
        ).json()
        assert created["slug"] == "investors"
        await owner.post(f"/api/v1/portfolios/{created['id']}/publish")

    client.headers.pop("Authorization", None)
    mine = await client.get(f"/api/v1/public/p/{TEST_HANDLE}/investors")
    theirs = await client.get(f"/api/v1/public/p/{OTHER_HANDLE}/investors")

    assert mine.status_code == 200
    assert theirs.status_code == 200
    assert mine.json()["id"] != theirs.json()["id"]


async def test_the_same_slug_twice_in_one_account_is_409(auth_client):
    body = {"name": "N", "slug": "investors", "startFrom": {"kind": "blank"}}
    assert (await auth_client.post("/api/v1/portfolios", json=body)).status_code == 201

    response = await auth_client.post("/api/v1/portfolios", json=body)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "slug_taken"


async def test_the_wrong_handle_does_not_reach_the_page(auth_client, client, published):
    """A page is at one address, not at everybody's."""
    client.headers.pop("Authorization", None)
    assert (
        await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{published['slug']}")
    ).status_code == 200
    assert (
        await client.get(f"/api/v1/public/p/{OTHER_HANDLE}/{published['slug']}")
    ).status_code == 404
    assert (
        await client.get(f"/api/v1/public/p/nobody/{published['slug']}")
    ).status_code == 404


async def test_recording_a_view_needs_the_handle_too(auth_client, client):
    created = (
        await auth_client.post(
            "/api/v1/portfolios",
            json={"name": "Investors", "slug": "investors",
                  "startFrom": {"kind": "blank"}},
        )
    ).json()
    await auth_client.post(f"/api/v1/portfolios/{created['id']}/publish")

    response = await client.post(
        f"/api/v1/public/p/{TEST_HANDLE}/investors/views",
        json={"referrer": "", "dedupeKey": "one"},
    )
    assert response.status_code == 202

    summary = (await auth_client.get("/api/v1/analytics/summary")).json()
    assert summary["views"]["investors"] == 1


async def test_the_seed_imports_and_reads_back(auth_client):
    response = await auth_client.post(
        "/api/v1/import", json={"mode": "replace", "portfolios": seed_payload()}
    )
    assert response.status_code == 200
    assert response.json()["imported"] == 5
    assert response.json()["renamed"] == {}

    rows = (await auth_client.get("/api/v1/portfolios")).json()
    assert len(rows) == 5
    assert {row["slug"] for row in rows} == {
        "full", "investors", "advisory", "writing", "board"
    }
    # Every seeded portfolio has content; an empty one would mean the import
    # silently dropped its sections.
    assert all(row["sectionCount"] > 0 for row in rows)


async def test_the_seeds_live_pages_publish_and_serve(auth_client, client):
    await auth_client.post(
        "/api/v1/import", json={"mode": "replace", "portfolios": seed_payload()}
    )

    rows = (await auth_client.get("/api/v1/portfolios")).json()
    full = next(row for row in rows if row["slug"] == "full")
    assert full["status"] == "live"

    detail = (await auth_client.get(f"/api/v1/portfolios/{full['id']}")).json()
    assert detail["header"]["name"] == "Rohan Mehta"
    assert len(detail["sections"]) == 6
    assert detail["sections"][0]["title"] == "Northwell Kitchens"
    assert detail["header"]["numbers"][0]["value"] == "11"

    published = await client.get(f"/api/v1/public/p/{TEST_HANDLE}/full")
    assert published.status_code == 200
    assert published.json()["header"]["name"] == "Rohan Mehta"


async def test_seeded_hidden_sections_stay_off_the_published_page(auth_client, client):
    await auth_client.post(
        "/api/v1/import", json={"mode": "replace", "portfolios": seed_payload()}
    )
    payload = seed_payload()

    for portfolio in payload:
        hidden = [s for s in portfolio["sections"] if s.get("hidden")]
        if not hidden:
            continue
        response = await client.get(
            f"/api/v1/public/p/{TEST_HANDLE}/{portfolio['slug']}"
        )
        if response.status_code != 200:
            continue
        served = {s["title"] for s in response.json()["sections"]}
        assert served.isdisjoint({s["title"] for s in hidden})
