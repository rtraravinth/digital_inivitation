"""Pictures, components, and the footer.

A section is title, description, links and any number of pictures, plus
components under them. The page ends in a footer of its own. Each of these
has to round-trip, respect ownership, and — for anything that reaches a
visitor — respect the owner's "show contact" switch.
"""

from __future__ import annotations

import io

from PIL import Image
from sqlalchemy import select

from app.models import Asset
from tests.factories import TEST_HANDLE

PUBLIC = f"/api/v1/public/p/{TEST_HANDLE}"


def png_bytes(colour=(10, 20, 30)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (40, 40), colour).save(buffer, format="PNG")
    return buffer.getvalue()


async def upload(client, colour=(10, 20, 30)) -> str:
    response = await client.post(
        "/api/v1/assets",
        files={"file": ("p.png", png_bytes(colour), "image/png")},
        data={"kind": "image"},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def section_path(portfolio: dict) -> str:
    return f"/api/v1/portfolios/{portfolio['id']}/sections/{portfolio['sections'][0]['id']}"


TIMELINE = {
    "id": "b1",
    "type": "timeline",
    "title": "How it went",
    "items": [{"id": "t1", "date": "2021", "title": "Founded", "text": "In a garage."}],
}
CONTACT = {
    "id": "b2",
    "type": "contact",
    "title": "Get in touch",
    "text": "Usually replies within a day.",
    "email": "rohan@example.com",
    "phone": "+91 98450 00000",
    "location": "Bengaluru",
    "ctaLabel": "Book a call",
    "ctaUrl": "https://cal.example.com/rohan",
    "form": True,
}


# ── pictures ────────────────────────────────────────────────────────────


async def test_pictures_keep_the_order_they_were_sent_in(auth_client, portfolio):
    a, b, c = [await upload(auth_client, (i, i, i)) for i in (1, 2, 3)]
    response = await auth_client.patch(section_path(portfolio), json={"imageAssetIds": [c, a, b]})
    assert response.status_code == 200, response.text
    assert [image["id"] for image in response.json()["images"]] == [c, a, b]


async def test_a_repeated_picture_is_kept_once(auth_client, portfolio):
    a = await upload(auth_client)
    response = await auth_client.patch(section_path(portfolio), json={"imageAssetIds": [a, a]})
    assert [image["id"] for image in response.json()["images"]] == [a]


async def test_reordering_pictures_keeps_every_upload(auth_client, portfolio, db_session):
    a, b = await upload(auth_client, (1, 1, 1)), await upload(auth_client, (2, 2, 2))
    path = section_path(portfolio)
    await auth_client.patch(path, json={"imageAssetIds": [a, b]})
    response = await auth_client.patch(path, json={"imageAssetIds": [b, a]})
    assert [image["id"] for image in response.json()["images"]] == [b, a]
    stored = {str(i) for i in await db_session.scalars(select(Asset.id))}
    assert {a, b} <= stored


async def test_a_picture_dropped_from_the_list_is_released(auth_client, portfolio, db_session):
    a, b = await upload(auth_client, (1, 1, 1)), await upload(auth_client, (2, 2, 2))
    path = section_path(portfolio)
    await auth_client.patch(path, json={"imageAssetIds": [a, b]})
    await auth_client.patch(path, json={"imageAssetIds": [b]})
    stored = {str(i) for i in await db_session.scalars(select(Asset.id))}
    assert a not in stored
    assert b in stored


async def test_absent_pictures_are_left_alone(auth_client, portfolio):
    a = await upload(auth_client)
    path = section_path(portfolio)
    await auth_client.patch(path, json={"imageAssetIds": [a]})
    response = await auth_client.patch(path, json={"title": "Renamed"})
    assert [image["id"] for image in response.json()["images"]] == [a]


async def test_another_users_picture_is_404(auth_client, other_auth_client, portfolio):
    theirs = await upload(other_auth_client)
    response = await auth_client.patch(section_path(portfolio), json={"imageAssetIds": [theirs]})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "asset_not_found"


async def test_more_than_twelve_pictures_is_refused(auth_client, portfolio):
    a = await upload(auth_client)
    response = await auth_client.patch(section_path(portfolio), json={"imageAssetIds": [a] * 13})
    assert response.status_code == 422


async def test_a_second_picture_on_a_live_page_is_public(auth_client, client, portfolio):
    a, b = await upload(auth_client, (1, 1, 1)), await upload(auth_client, (2, 2, 2))
    await auth_client.patch(section_path(portfolio), json={"imageAssetIds": [a, b]})
    await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/publish")

    page = (await client.get(f"{PUBLIC}/{portfolio['slug']}")).json()
    assert page["sections"][0]["images"][1]["url"] == f"/api/v1/public/assets/{b}"
    assert (await client.get(f"/api/v1/public/assets/{b}")).status_code == 200


async def test_a_picture_on_a_draft_is_not_public(auth_client, client, portfolio):
    a = await upload(auth_client)
    await auth_client.patch(section_path(portfolio), json={"imageAssetIds": [a]})
    assert (await client.get(f"/api/v1/public/assets/{a}")).status_code == 404


# ── components ──────────────────────────────────────────────────────────


async def test_components_round_trip_in_order(auth_client, portfolio):
    path = section_path(portfolio)
    response = await auth_client.patch(path, json={"blocks": [CONTACT, TIMELINE]})
    assert response.status_code == 200, response.text
    blocks = response.json()["blocks"]
    assert [b["type"] for b in blocks] == ["contact", "timeline"]
    assert blocks[1]["items"][0]["title"] == "Founded"
    assert blocks[0]["ctaUrl"] == "https://cal.example.com/rohan"


async def test_every_component_type_is_accepted(auth_client, portfolio):
    blocks = [
        TIMELINE,
        {"id": "c", "type": "testimonials",
         "items": [{"id": "1", "quote": "Calm under pressure.", "name": "Asha", "role": "CEO"}]},
        {"id": "d", "type": "clients", "items": [{"id": "1", "name": "Zerodha", "url": ""}]},
        {"id": "e", "type": "tabs", "items": [{"id": "1", "label": "Approach", "text": "Listen."}]},
        {"id": "f", "type": "stats", "items": [{"id": "1", "value": "40+", "label": "Clients"}]},
        {"id": "g", "type": "services",
         "items": [{"id": "1", "title": "Audit", "text": "Two weeks.", "price": "From ₹40,000"}]},
        {"id": "h", "type": "faq", "items": [{"id": "1", "question": "Remote?", "answer": "Yes."}]},
        CONTACT,
        {"id": "i", "type": "gallery", "title": "", "layout": "grid", "imageIds": []},
    ]
    response = await auth_client.patch(section_path(portfolio), json={"blocks": blocks})
    assert response.status_code == 200, response.text
    assert len(response.json()["blocks"]) == 9


async def test_a_gallery_names_the_sections_pictures(auth_client, portfolio):
    """The pictures stay the section's rows; the gallery holds their order."""
    cover, one, two = [await upload(auth_client, (n, n, n)) for n in (1, 2, 3)]
    gallery = {"id": "g", "type": "gallery", "title": "On site", "layout": "strip", "imageIds": [two, one]}
    response = await auth_client.patch(
        section_path(portfolio),
        json={"imageAssetIds": [cover, one, two], "blocks": [gallery]},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert [image["id"] for image in body["images"]] == [cover, one, two]
    assert body["blocks"] == [gallery]


async def test_a_gallery_defaults_to_a_mosaic(auth_client, portfolio):
    response = await auth_client.patch(
        section_path(portfolio), json={"blocks": [{"id": "g", "type": "gallery"}]}
    )
    assert response.status_code == 200, response.text
    assert response.json()["blocks"][0] == {
        "id": "g", "type": "gallery", "title": "", "layout": "mosaic", "imageIds": []
    }


async def test_an_unknown_gallery_layout_is_refused(auth_client, portfolio):
    response = await auth_client.patch(
        section_path(portfolio),
        json={"blocks": [{"id": "g", "type": "gallery", "layout": "carousel", "imageIds": []}]},
    )
    assert response.status_code == 422


async def test_a_gallery_holds_no_more_pictures_than_a_section(auth_client, portfolio):
    response = await auth_client.patch(
        section_path(portfolio),
        json={"blocks": [{"id": "g", "type": "gallery", "imageIds": [str(n) for n in range(13)]}]},
    )
    assert response.status_code == 422


async def test_an_unknown_component_type_is_refused(auth_client, portfolio):
    response = await auth_client.patch(
        section_path(portfolio), json={"blocks": [{"id": "x", "type": "carousel", "items": []}]}
    )
    assert response.status_code == 422


async def test_a_misspelled_component_field_is_refused(auth_client, portfolio):
    """A typo must fail loudly, not save as a component that renders nothing."""
    response = await auth_client.patch(
        section_path(portfolio),
        json={"blocks": [{**TIMELINE, "itmes": []}]},
    )
    assert response.status_code == 422


async def test_an_empty_list_clears_the_components(auth_client, portfolio):
    path = section_path(portfolio)
    await auth_client.patch(path, json={"blocks": [TIMELINE]})
    response = await auth_client.patch(path, json={"blocks": []})
    assert response.json()["blocks"] == []


async def test_contact_details_follow_the_show_contact_switch(auth_client, client, portfolio):
    await auth_client.patch(section_path(portfolio), json={"blocks": [CONTACT]})
    await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/publish")
    await auth_client.patch("/api/v1/account/privacy", json={"showContact": False})

    block = (await client.get(f"{PUBLIC}/{portfolio['slug']}")).json()["sections"][0]["blocks"][0]
    assert block["text"] == "Usually replies within a day."
    assert block["email"] == ""
    assert block["phone"] == ""
    assert block["ctaUrl"] == ""
    assert block["form"] is False


# ── the footer ──────────────────────────────────────────────────────────


FOOTER = {
    "headline": "Let's build something",
    "text": "Taking on two projects this quarter.",
    "ctaLabel": "Email me",
    "ctaUrl": "mailto:rohan@example.com",
    "links": [{"id": "l1", "label": "LinkedIn", "url": "https://linkedin.com/in/rohan"}],
    "note": "© 2026 Rohan Mehta",
    "showHeaderLinks": False,
}


async def test_a_new_portfolio_has_an_empty_footer(portfolio):
    assert portfolio["footer"]["headline"] == ""
    assert portfolio["footer"]["showHeaderLinks"] is True


async def test_the_footer_round_trips(auth_client, portfolio):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"footer": FOOTER}
    )
    assert response.status_code == 200, response.text
    footer = response.json()["footer"]
    assert {k: v for k, v in footer.items() if k != "links"} == {
        k: v for k, v in FOOTER.items() if k != "links"
    }
    assert footer["links"][0]["url"] == FOOTER["links"][0]["url"]


async def test_a_misspelled_footer_field_is_refused(auth_client, portfolio):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"footer": {"headlin": "Hi"}}
    )
    assert response.status_code == 422


async def test_the_public_footer_drops_its_links_when_contact_is_hidden(
    auth_client, client, portfolio
):
    await auth_client.patch(f"/api/v1/portfolios/{portfolio['id']}", json={"footer": FOOTER})
    await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/publish")

    shown = (await client.get(f"{PUBLIC}/{portfolio['slug']}")).json()["footer"]
    assert shown["links"][0]["label"] == "LinkedIn"

    await auth_client.patch("/api/v1/account/privacy", json={"showContact": False})
    hidden = (await client.get(f"{PUBLIC}/{portfolio['slug']}")).json()["footer"]
    assert hidden["headline"] == "Let's build something"
    assert hidden["links"] == []
    assert hidden["ctaUrl"] == ""


# ── copy, export, import ────────────────────────────────────────────────


async def test_a_copy_takes_pictures_components_and_footer(auth_client, portfolio):
    a = await upload(auth_client)
    await auth_client.patch(
        section_path(portfolio), json={"imageAssetIds": [a], "blocks": [TIMELINE]}
    )
    await auth_client.patch(f"/api/v1/portfolios/{portfolio['id']}", json={"footer": FOOTER})

    response = await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "Copy", "slug": "copy", "startFrom": {"kind": "copy", "id": portfolio["id"]}},
    )
    assert response.status_code == 201, response.text
    copy = response.json()
    assert copy["sections"][0]["images"][0]["id"] == a
    assert copy["sections"][0]["blocks"][0]["type"] == "timeline"
    assert copy["footer"]["headline"] == FOOTER["headline"]


async def test_export_and_import_carry_components_and_footer(auth_client, portfolio):
    await auth_client.patch(section_path(portfolio), json={"blocks": [TIMELINE, CONTACT]})
    await auth_client.patch(f"/api/v1/portfolios/{portfolio['id']}", json={"footer": FOOTER})

    exported = (await auth_client.get("/api/v1/export")).json()
    assert exported[0]["sections"][0]["blocks"][0]["type"] == "timeline"
    # One malformed component must not sink the rest.
    exported[0]["sections"][0]["blocks"].append({"id": "z", "type": "nonsense"})

    response = await auth_client.post("/api/v1/import", json={"mode": "replace", "portfolios": exported})
    assert response.status_code == 200, response.text

    imported = (await auth_client.get("/api/v1/portfolios?expand=sections")).json()[0]
    assert [b["type"] for b in imported["sections"][0]["blocks"]] == ["timeline", "contact"]
    assert imported["footer"]["note"] == FOOTER["note"]
