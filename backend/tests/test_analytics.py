"""Analytics: counted from events, never invented."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.models import PageView
from app.services.analytics import source_from_referrer
from tests.factories import OTHER_HANDLE, TEST_HANDLE


@pytest.mark.parametrize(
    "referrer,expected",
    [
        ("", "Direct"),
        ("https://www.linkedin.com/feed", "LinkedIn"),
        ("https://l.instagram.com/", "l.instagram.com"),
        ("https://api.whatsapp.com/send", "WhatsApp"),
        ("https://t.co/abc", "X"),
        ("https://x.com/someone", "X"),
        ("https://mail.google.com/", "Email"),
        ("http://localhost:3000/", "Direct"),
        ("https://facet.page/rohan", "Direct"),
        ("not a url", "Direct"),
    ],
)
def test_referrer_buckets_match_the_frontends(referrer, expected):
    assert source_from_referrer(referrer) == expected


async def test_a_view_is_counted_and_attributed(client, auth_client, published):
    response = await client.post(
        f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}/views",
        json={"referrer": "https://www.linkedin.com/feed", "dedupeKey": "load-1"},
    )
    assert response.status_code == 202
    assert response.json() == {"counted": True}

    summary = (await auth_client.get("/api/v1/analytics/summary")).json()
    assert summary["views"][published["slug"]] == 1
    assert summary["sources"][published["slug"]]["LinkedIn"] == 1
    assert summary["totals"]["views"] == 1


async def test_the_same_dedupe_key_does_not_count_twice(client, auth_client, published):
    for _ in range(3):
        await client.post(
            f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}/views",
            json={"referrer": "", "dedupeKey": "one-load"},
        )

    summary = (await auth_client.get("/api/v1/analytics/summary")).json()
    assert summary["views"][published["slug"]] == 1


async def test_different_loads_each_count(client, auth_client, published):
    for index in range(3):
        await client.post(
            f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}/views",
            json={"referrer": "", "dedupeKey": f"load-{index}"},
        )

    summary = (await auth_client.get("/api/v1/analytics/summary")).json()
    assert summary["views"][published["slug"]] == 3


async def test_clicks_are_counted_per_section(client, auth_client, published):
    section_id = published["sections"][0]["id"]
    for _ in range(2):
        await client.post(
            f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}/clicks",
            json={"sectionId": section_id, "url": "https://northwell.in"},
        )

    summary = (await auth_client.get("/api/v1/analytics/summary")).json()
    assert summary["clicks"][published["slug"]][section_id] == 2
    assert summary["totals"]["clicks"] == 2


async def test_a_click_survives_its_section_being_deleted(client, auth_client, published):
    section_id = published["sections"][0]["id"]
    await client.post(
        f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}/clicks",
        json={"sectionId": section_id, "url": "https://northwell.in"},
    )
    await auth_client.delete(f"/api/v1/portfolios/{published['id']}/sections/{section_id}")

    # The click happened. Deleting the section does not unmake it.
    summary = (await auth_client.get("/api/v1/analytics/summary")).json()
    assert summary["totals"]["clicks"] == 1


async def test_count_visits_off_records_nothing(auth_client, client, published):
    await auth_client.patch("/api/v1/account/privacy", json={"countVisits": False})

    response = await client.post(
        f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}/views",
        json={"referrer": "", "dedupeKey": "k"},
    )
    # Still 202: a visitor never sees an analytics decision.
    assert response.status_code == 202
    assert response.json() == {"counted": False}

    assert (await auth_client.get("/api/v1/analytics/summary")).json()["views"] == {}


async def test_recording_against_an_unpublished_page_is_404(auth_client, client, portfolio):
    response = await client.post(
        f"/api/v1/public/p/{TEST_HANDLE}/{portfolio["slug"]}/views",
        json={"referrer": "", "dedupeKey": "k"},
    )
    assert response.status_code == 404


async def test_an_empty_summary_is_empty_never_invented(auth_client, published):
    summary = (await auth_client.get("/api/v1/analytics/summary")).json()
    assert summary == {
        "views": {},
        "clicks": {},
        "sources": {},
        "totals": {"views": 0, "clicks": 0},
    }


async def test_the_range_window_excludes_older_events(
    auth_client, client, published, db_session
):
    await client.post(
        f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}/views",
        json={"referrer": "", "dedupeKey": "old"},
    )
    await db_session.execute(
        update(PageView).values(occurred_at=datetime.now(UTC) - timedelta(days=90))
    )

    recent = (await auth_client.get("/api/v1/analytics/summary", params={"days": 30})).json()
    assert recent["views"] == {}

    wider = (await auth_client.get("/api/v1/analytics/summary", params={"days": 365})).json()
    assert wider["views"][published["slug"]] == 1


async def test_i_only_see_my_own_analytics(auth_client, other_auth_client, client, published):
    await client.post(
        f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}/views",
        json={"referrer": "", "dedupeKey": "k"},
    )
    assert (await other_auth_client.get("/api/v1/analytics/summary")).json()["views"] == {}


async def test_reset_clears_my_events_only(
    auth_client, other_auth_client, client, published
):
    theirs = (
        await other_auth_client.post(
            "/api/v1/portfolios",
            json={"name": "T", "slug": "theirs-stats", "startFrom": {"kind": "blank"}},
        )
    ).json()
    await other_auth_client.post(f"/api/v1/portfolios/{theirs['id']}/publish")

    await client.post(
        f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}/views", json={"referrer": "", "dedupeKey": "a"}
    )
    await client.post(
        f"/api/v1/public/p/{OTHER_HANDLE}/{theirs["slug"]}/views", json={"referrer": "", "dedupeKey": "b"}
    )

    assert (await auth_client.delete("/api/v1/analytics")).status_code == 204

    assert (await auth_client.get("/api/v1/analytics/summary")).json()["views"] == {}
    assert (await other_auth_client.get("/api/v1/analytics/summary")).json()["views"] == {
        theirs["slug"]: 1
    }


async def test_the_summary_requires_a_token(client):
    client.headers.pop("Authorization", None)
    assert (await client.get("/api/v1/analytics/summary")).status_code == 401
