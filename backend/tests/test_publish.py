"""The published page, and the privacy switches that shape it."""

from __future__ import annotations

import io

from PIL import Image

from tests.factories import TEST_HANDLE


def png_bytes(width: int = 300, height: int = 300) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (20, 20, 20)).save(buffer, format="PNG")
    return buffer.getvalue()


async def go_live(auth_client, portfolio: dict) -> dict:
    """Publish a portfolio that has been edited first.

    A live portfolio refuses edits, so anything a test wants on the page has
    to be written while it is still a draft. That is the order the UI works
    in too.
    """
    response = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/publish")
    assert response.status_code == 200, response.text
    return response.json()


async def test_an_unpublished_page_is_404(client, portfolio):
    response = await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{portfolio["slug"]}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "page_not_found"


async def test_an_unknown_slug_is_404(client):
    response = await client.get(f"/api/v1/public/p/{TEST_HANDLE}/nobody-here")
    assert response.status_code == 404


async def test_a_published_page_is_readable_without_a_token(client, published):
    client.headers.pop("Authorization", None)

    response = await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}")
    assert response.status_code == 200

    body = response.json()
    assert body["theme"] == "editorial"
    assert body["slug"] == published["slug"]
    assert "sections" in body


async def test_an_unpublished_page_stops_being_readable(auth_client, client, published):
    await auth_client.post(f"/api/v1/portfolios/{published['id']}/unpublish")
    assert (await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}")).status_code == 404


async def test_hidden_sections_never_reach_the_published_payload(
    auth_client, client, portfolio
):
    section_id = portfolio["sections"][0]["id"]
    await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section_id}", json={"hidden": True}
    )
    published = await go_live(auth_client, portfolio)

    body = (await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}")).json()
    assert all(section["id"] != section_id for section in body["sections"])


async def test_show_contact_off_removes_the_header_links_from_the_body(
    auth_client, client, portfolio
):
    await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/header",
        json={"links": [{"id": "l1", "label": "Email", "url": "rohan@northwell.in"}]},
    )
    published = await go_live(auth_client, portfolio)
    assert (await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}")).json()["header"]["links"]

    await auth_client.patch("/api/v1/account/privacy", json={"showContact": False})

    body = (await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}")).json()
    # Absent from the payload, not merely hidden by CSS.
    assert body["header"]["links"] == []
    assert body["showContact"] is False
    assert "northwell.in" not in str(body)


async def test_indexable_off_sets_noindex_and_the_header(auth_client, client, published):
    await auth_client.patch("/api/v1/account/privacy", json={"indexable": False})

    response = await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}")
    assert response.status_code == 200
    assert response.json()["noindex"] is True
    assert "noindex" in response.headers["x-robots-tag"]


async def test_indexable_on_sends_no_robots_header(client, published):
    response = await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}")
    assert "x-robots-tag" not in response.headers
    assert response.json()["noindex"] is False


async def test_badge_off_is_reported_to_the_page(auth_client, client, published):
    await auth_client.patch("/api/v1/account/privacy", json={"badge": False})
    assert (await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}")).json()["badge"] is False


async def test_a_published_asset_is_public_and_cacheable(auth_client, client, portfolio):
    asset = (
        await auth_client.post(
            "/api/v1/assets",
            files={"file": ("h.png", png_bytes(), "image/png")},
            data={"kind": "image"},
        )
    ).json()
    await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/header", json={"portraitAssetId": asset["id"]}
    )
    await go_live(auth_client, portfolio)

    client.headers.pop("Authorization", None)
    response = await client.get(f"/api/v1/public/assets/{asset['id']}")
    assert response.status_code == 200
    assert response.headers["etag"]
    assert "max-age" in response.headers["cache-control"]
    assert "public" in response.headers["cache-control"]


async def test_the_published_payload_uses_public_asset_urls(auth_client, client, portfolio):
    asset = (
        await auth_client.post(
            "/api/v1/assets",
            files={"file": ("h.png", png_bytes(), "image/png")},
            data={"kind": "image"},
        )
    ).json()
    section_id = portfolio["sections"][0]["id"]
    await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section_id}",
        json={"imageAssetId": asset["id"]},
    )
    published = await go_live(auth_client, portfolio)

    body = (await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{published["slug"]}")).json()
    assert body["sections"][0]["image"]["url"] == f"/api/v1/public/assets/{asset['id']}"


async def test_an_unpublished_assets_public_url_is_404(auth_client, client):
    asset = (
        await auth_client.post(
            "/api/v1/assets",
            files={"file": ("x.png", png_bytes(100, 100), "image/png")},
            data={"kind": "image"},
        )
    ).json()

    assert (await client.get(f"/api/v1/public/assets/{asset['id']}")).status_code == 404
    # Still readable by its owner.
    assert (await auth_client.get(f"/api/v1/assets/{asset['id']}")).status_code == 200


async def test_an_asset_on_a_hidden_section_is_not_public(auth_client, client, portfolio):
    asset = (
        await auth_client.post(
            "/api/v1/assets",
            files={"file": ("x.png", png_bytes(120, 120), "image/png")},
            data={"kind": "image"},
        )
    ).json()
    section_id = portfolio["sections"][0]["id"]
    patch = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section_id}",
        json={"imageAssetId": asset["id"], "hidden": True},
    )
    assert patch.status_code == 200, patch.text
    await go_live(auth_client, portfolio)

    assert (await client.get(f"/api/v1/public/assets/{asset['id']}")).status_code == 404
