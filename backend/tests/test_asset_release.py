"""Uploads that lose their last reference are dropped, and only those.

The editor has no "manage uploads" screen, so nothing ever called
``DELETE /assets/{id}``: replacing a portrait or clearing a section image left
the row and its bytes behind for good. Releasing is deliberately narrow — it
acts on the id a row *used* to hold, never on a sweep of everything
unreferenced, because an upload is legitimately unattached between
``POST /assets`` and the PATCH that attaches it.
"""

from __future__ import annotations

import io

from PIL import Image
from sqlalchemy import select

from app.models import Asset


def png_bytes(colour=(10, 20, 30)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (40, 40), colour).save(buffer, format="PNG")
    return buffer.getvalue()


async def upload(client, colour) -> str:
    response = await client.post(
        "/api/v1/assets",
        files={"file": ("p.png", png_bytes(colour), "image/png")},
        data={"kind": "image"},
    )
    assert response.status_code == 201
    return response.json()["id"]


async def rows(db_session) -> set[str]:
    result = await db_session.scalars(select(Asset.id))
    return {str(value) for value in result}


async def test_replacing_a_section_image_drops_the_old_one(auth_client, portfolio, db_session):
    section = (
        await auth_client.post(
            f"/api/v1/portfolios/{portfolio['id']}/sections", json={"kind": "gallery"}
        )
    ).json()
    first, second = await upload(auth_client, (1, 2, 3)), await upload(auth_client, (4, 5, 6))
    path = f"/api/v1/portfolios/{portfolio['id']}/sections/{section['id']}"

    await auth_client.patch(path, json={"imageAssetId": first})
    assert first in await rows(db_session)

    await auth_client.patch(path, json={"imageAssetId": second})
    remaining = await rows(db_session)
    assert first not in remaining
    assert second in remaining


async def test_clearing_a_section_image_drops_it(auth_client, portfolio, db_session):
    section = (
        await auth_client.post(
            f"/api/v1/portfolios/{portfolio['id']}/sections", json={"kind": "gallery"}
        )
    ).json()
    asset = await upload(auth_client, (7, 8, 9))
    path = f"/api/v1/portfolios/{portfolio['id']}/sections/{section['id']}"

    await auth_client.patch(path, json={"imageAssetId": asset})
    await auth_client.patch(path, json={"clearImage": True})

    assert asset not in await rows(db_session)


async def test_an_upload_still_used_elsewhere_survives(auth_client, portfolio, db_session):
    """The same asset on two sections: detaching one must not delete it."""
    make = lambda: auth_client.post(  # noqa: E731
        f"/api/v1/portfolios/{portfolio['id']}/sections", json={"kind": "gallery"}
    )
    one, two = (await make()).json(), (await make()).json()
    asset = await upload(auth_client, (11, 12, 13))
    base = f"/api/v1/portfolios/{portfolio['id']}/sections"

    await auth_client.patch(f"{base}/{one['id']}", json={"imageAssetId": asset})
    await auth_client.patch(f"{base}/{two['id']}", json={"imageAssetId": asset})
    await auth_client.patch(f"{base}/{one['id']}", json={"clearImage": True})

    assert asset in await rows(db_session)
    assert (await auth_client.get(f"/api/v1/assets/{asset}")).status_code == 200


async def test_an_unattached_upload_is_left_alone(auth_client, portfolio, db_session):
    """The window between uploading and attaching must not collect it."""
    section = (
        await auth_client.post(
            f"/api/v1/portfolios/{portfolio['id']}/sections", json={"kind": "gallery"}
        )
    ).json()
    attached, loose = await upload(auth_client, (1, 1, 1)), await upload(auth_client, (2, 2, 2))
    path = f"/api/v1/portfolios/{portfolio['id']}/sections/{section['id']}"

    await auth_client.patch(path, json={"imageAssetId": attached})
    # An edit that touches nothing about attachments, while `loose` waits.
    await auth_client.patch(path, json={"title": "Still here"})

    assert loose in await rows(db_session)


async def test_replacing_the_header_portrait_drops_the_old_one(
    auth_client, portfolio, db_session
):
    first, second = await upload(auth_client, (3, 3, 3)), await upload(auth_client, (5, 5, 5))
    path = f"/api/v1/portfolios/{portfolio['id']}/header"

    await auth_client.patch(path, json={"portraitAssetId": first})
    await auth_client.patch(path, json={"portraitAssetId": second})

    remaining = await rows(db_session)
    assert first not in remaining
    assert second in remaining


async def test_clearing_the_account_portrait_drops_it(auth_client, db_session):
    asset = await upload(auth_client, (9, 9, 9))

    await auth_client.patch("/api/v1/account/profile", json={"portraitAssetId": asset})
    await auth_client.patch("/api/v1/account/profile", json={"clearPortrait": True})

    assert asset not in await rows(db_session)
