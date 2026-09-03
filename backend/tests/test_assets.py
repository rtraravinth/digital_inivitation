"""Uploads: processing, sniffing, limits and ownership."""

from __future__ import annotations

import io

import pytest
from PIL import Image
from sqlalchemy import select

from app.models import Asset


def png_bytes(width: int = 2400, height: int = 1200, colour=(120, 90, 60)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(buffer, format="PNG")
    return buffer.getvalue()


async def upload(client, data: bytes, name: str = "photo.png", kind: str = "image",
                 content_type: str = "image/png"):
    return await client.post(
        "/api/v1/assets",
        files={"file": (name, data, content_type)},
        data={"kind": kind},
    )


async def test_uploading_a_large_image_downscales_and_reencodes_it(auth_client):
    response = await upload(auth_client, png_bytes())
    assert response.status_code == 201

    asset = response.json()
    assert asset["mime"] == "image/jpeg"
    assert max(asset["width"], asset["height"]) == 1400
    assert asset["size"] < 420 * 1024
    assert asset["url"] == f"/api/v1/assets/{asset['id']}"
    assert asset["name"] == "photo.png"


async def test_a_small_image_keeps_its_dimensions(auth_client):
    asset = (await upload(auth_client, png_bytes(400, 400))).json()
    assert (asset["width"], asset["height"]) == (400, 400)


async def test_the_stored_bytes_are_served_back(auth_client):
    asset = (await upload(auth_client, png_bytes(400, 300))).json()

    response = await auth_client.get(f"/api/v1/assets/{asset['id']}")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["etag"]
    assert Image.open(io.BytesIO(response.content)).size == (400, 300)


@pytest.mark.parametrize(
    "payload",
    [
        b"#!/bin/sh\nrm -rf /",
        b"<html><body>not an image</body></html>",
        b"\x00\x01\x02\x03 random bytes",
    ],
)
async def test_the_mime_is_sniffed_not_trusted(auth_client, payload):
    response = await upload(auth_client, payload, name="evil.png")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_media"


async def test_an_empty_upload_is_refused(auth_client):
    response = await upload(auth_client, b"")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "empty_upload"


async def test_a_pdf_attachment_is_accepted(auth_client):
    response = await upload(
        auth_client, b"%PDF-1.4\n" + b"0" * 2048, name="one-pager.pdf",
        kind="file", content_type="application/pdf",
    )
    assert response.status_code == 201
    assert response.json()["mime"] == "application/pdf"


async def test_an_oversized_attachment_is_413(auth_client):
    response = await upload(
        auth_client, b"%PDF-1.4\n" + b"0" * (900 * 1024), name="big.pdf",
        kind="file", content_type="application/pdf",
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"


async def test_an_unsupported_attachment_type_is_415(auth_client):
    response = await upload(
        auth_client, b"MZ\x90\x00 executable", name="tool.exe",
        kind="file", content_type="application/octet-stream",
    )
    assert response.status_code == 415


async def test_an_svg_passes_through(auth_client):
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
    response = await upload(auth_client, svg, name="mark.svg", content_type="image/svg+xml")
    assert response.status_code == 201
    assert response.json()["mime"] == "image/svg+xml"


async def test_a_broken_svg_is_refused(auth_client):
    response = await upload(
        auth_client, b"<svg><rect></svg", name="broken.svg", content_type="image/svg+xml"
    )
    assert response.status_code == 415


async def test_uploading_the_same_bytes_twice_reuses_one_file(auth_client, db_session):
    payload = png_bytes(300, 300)
    first = (await upload(auth_client, payload, name="a.png")).json()
    second = (await upload(auth_client, payload, name="b.png")).json()

    assert first["id"] != second["id"]
    assert first["name"] == "a.png" and second["name"] == "b.png"

    keys = (await db_session.execute(select(Asset.storage_key).distinct())).scalars().all()
    assert len(keys) == 1


async def test_deleting_one_of_two_rows_keeps_the_shared_blob(auth_client):
    payload = png_bytes(300, 300)
    first = (await upload(auth_client, payload, name="a.png")).json()
    second = (await upload(auth_client, payload, name="b.png")).json()

    assert (await auth_client.delete(f"/api/v1/assets/{first['id']}")).status_code == 204
    # The survivor must still be readable.
    assert (await auth_client.get(f"/api/v1/assets/{second['id']}")).status_code == 200


async def test_attaching_an_asset_to_a_section_returns_it_nested(auth_client, portfolio):
    asset = (await upload(auth_client, png_bytes(500, 500))).json()
    section_id = portfolio["sections"][0]["id"]

    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section_id}",
        json={"imageAssetId": asset["id"]},
    )
    assert response.status_code == 200
    assert response.json()["image"]["url"] == asset["url"]

    cleared = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section_id}",
        json={"clearImage": True},
    )
    assert cleared.json()["image"] is None


async def test_attaching_a_portrait_to_the_header(auth_client, portfolio):
    asset = (await upload(auth_client, png_bytes(600, 600))).json()

    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/header",
        json={"portraitAssetId": asset["id"]},
    )
    assert response.status_code == 200
    assert response.json()["header"]["portrait"]["id"] == asset["id"]


async def test_attaching_another_users_asset_is_404(auth_client, other_auth_client, portfolio):
    theirs = (await upload(other_auth_client, png_bytes(200, 200), name="t.png")).json()
    section_id = portfolio["sections"][0]["id"]

    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section_id}",
        json={"imageAssetId": theirs["id"]},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "asset_not_found"


async def test_reading_another_users_asset_directly_is_404(auth_client, other_auth_client):
    theirs = (await upload(other_auth_client, png_bytes(200, 200), name="t.png")).json()
    assert (await auth_client.get(f"/api/v1/assets/{theirs['id']}")).status_code == 404


async def test_deleting_another_users_asset_is_404(auth_client, other_auth_client):
    theirs = (await upload(other_auth_client, png_bytes(200, 200), name="t.png")).json()
    assert (await auth_client.delete(f"/api/v1/assets/{theirs['id']}")).status_code == 404
    assert (await other_auth_client.get(f"/api/v1/assets/{theirs['id']}")).status_code == 200


async def test_uploading_requires_a_token(client):
    client.headers.pop("Authorization", None)
    response = await upload(client, png_bytes(100, 100))
    assert response.status_code == 401
