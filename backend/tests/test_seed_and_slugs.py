"""Nested addresses, and the seeded content importing cleanly.

The seeded pages use addresses like ``rohan/investors`` — a role-specific
version of a page — because the published route is a catch-all. Anything that
handles a slug has to cope with the separator.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

SEED_FILE = Path(__file__).resolve().parents[1] / "app" / "seed_data.json"


def seed_payload() -> list[dict]:
    return json.loads(SEED_FILE.read_text(encoding="utf-8"))


def test_the_seed_fixture_exists_and_holds_the_five_portfolios():
    payload = seed_payload()
    assert len(payload) == 5
    assert {p["slug"] for p in payload} == {
        "rohan",
        "rohan/investors",
        "rohan/advisory",
        "rohan/writing",
        "rohan/board",
    }


@pytest.mark.parametrize("slug", ["rohan", "rohan/investors", "a-b/c-d/e-f"])
async def test_a_nested_slug_is_accepted(auth_client, slug):
    response = await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "N", "slug": slug, "startFrom": {"kind": "blank"}},
    )
    assert response.status_code == 201, response.text
    assert response.json()["slug"] == slug


@pytest.mark.parametrize(
    "slug", ["Not A Slug!", "/leading", "trailing/", "double//slash", "-hyphen", "up/../out"]
)
async def test_a_malformed_slug_is_422(auth_client, slug):
    response = await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "N", "slug": slug, "startFrom": {"kind": "blank"}},
    )
    assert response.status_code == 422


async def test_a_nested_slug_serves_its_published_page(auth_client, client):
    created = (
        await auth_client.post(
            "/api/v1/portfolios",
            json={"name": "Investors", "slug": "rohan/investors",
                  "startFrom": {"kind": "blank"}},
        )
    ).json()
    await auth_client.post(f"/api/v1/portfolios/{created['id']}/publish")

    client.headers.pop("Authorization", None)
    response = await client.get("/api/v1/public/p/rohan/investors")
    assert response.status_code == 200
    assert response.json()["slug"] == "rohan/investors"


async def test_recording_a_view_against_a_nested_slug_works(auth_client, client):
    created = (
        await auth_client.post(
            "/api/v1/portfolios",
            json={"name": "Investors", "slug": "rohan/investors",
                  "startFrom": {"kind": "blank"}},
        )
    ).json()
    await auth_client.post(f"/api/v1/portfolios/{created['id']}/publish")

    # The greedy path converter must not swallow the /views suffix.
    response = await client.post(
        "/api/v1/public/p/rohan/investors/views",
        json={"referrer": "", "dedupeKey": "one"},
    )
    assert response.status_code == 202

    summary = (await auth_client.get("/api/v1/analytics/summary")).json()
    assert summary["views"]["rohan/investors"] == 1


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
        "rohan", "rohan/investors", "rohan/advisory", "rohan/writing", "rohan/board"
    }
    # Every seeded portfolio has content; an empty one would mean the import
    # silently dropped its sections.
    assert all(row["sectionCount"] > 0 for row in rows)


async def test_the_seeds_live_pages_publish_and_serve(auth_client, client):
    await auth_client.post(
        "/api/v1/import", json={"mode": "replace", "portfolios": seed_payload()}
    )

    rows = (await auth_client.get("/api/v1/portfolios")).json()
    full = next(row for row in rows if row["slug"] == "rohan")
    assert full["status"] == "live"

    detail = (await auth_client.get(f"/api/v1/portfolios/{full['id']}")).json()
    assert detail["header"]["name"] == "Rohan Mehta"
    assert len(detail["sections"]) == 6
    assert detail["sections"][0]["title"] == "Northwell Kitchens"
    assert detail["sections"][0]["numbers"][0]["value"] == "11"

    published = await client.get("/api/v1/public/p/rohan")
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
        response = await client.get(f"/api/v1/public/p/{portfolio['slug']}")
        if response.status_code != 200:
            continue
        served = {s["title"] for s in response.json()["sections"]}
        assert served.isdisjoint({s["title"] for s in hidden})
