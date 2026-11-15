"""Publishing the resume on its own, and what that freezes."""

from __future__ import annotations

import pytest

from app.schemas.resume import resume_from_stored
from tests.factories import TEST_SUBDOMAIN


async def publish_resume(auth_client, portfolio: dict) -> dict:
    response = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/resume/publish")
    assert response.status_code == 200, response.text
    return response.json()


async def rename_section(auth_client, portfolio: dict):
    sid = portfolio["sections"][0]["id"]
    return await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{sid}", json={"title": "x"}
    )


async def test_a_new_portfolio_has_a_draft_resume(auth_client, portfolio):
    body = (await auth_client.get(f"/api/v1/portfolios/{portfolio['id']}")).json()
    assert body["resumeStatus"] == "draft"


async def test_publishing_the_resume_leaves_the_page_a_draft(auth_client, client, portfolio):
    body = await publish_resume(auth_client, portfolio)
    assert body["resumeStatus"] == "live"
    assert body["status"] != "live"

    response = await client.get(f"/api/v1/public/p/{TEST_SUBDOMAIN}/{portfolio['slug']}")
    assert response.status_code == 404


async def test_a_live_resume_freezes_sections(auth_client, portfolio):
    await publish_resume(auth_client, portfolio)
    response = await rename_section(auth_client, portfolio)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "portfolio_published"


async def test_a_live_resume_still_takes_resume_only_fields(auth_client, portfolio):
    url = f"/api/v1/portfolios/{portfolio['id']}/resume"
    resume = (await auth_client.get(f"/api/v1/portfolios/{portfolio['id']}")).json()["resume"]
    await publish_resume(auth_client, portfolio)

    styled = {**resume, "style": {**resume["style"], "accent": "#112233"}}
    assert (await auth_client.put(url, json=styled)).status_code == 200

    changed = {**resume, "skills": [{"id": "g1", "name": "Tools", "items": ["Python"]}]}
    assert (await auth_client.put(url, json=changed)).status_code == 409


async def test_unpublishing_the_page_keeps_a_live_resume_frozen(auth_client, portfolio):
    await publish_resume(auth_client, portfolio)
    await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/publish")
    await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/unpublish")
    assert (await rename_section(auth_client, portfolio)).status_code == 409


async def test_unpublishing_the_resume_thaws(auth_client, portfolio):
    await publish_resume(auth_client, portfolio)
    response = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/resume/unpublish")
    assert response.json()["resumeStatus"] == "draft"
    assert (await rename_section(auth_client, portfolio)).status_code == 200


async def test_an_import_lands_with_a_draft_resume(auth_client, portfolio):
    exported = (await auth_client.get("/api/v1/export")).json()
    exported[0]["resumeStatus"] = "live"
    response = await auth_client.post(
        "/api/v1/import", json={"mode": "replace", "portfolios": exported}
    )
    assert response.status_code == 200, response.text
    listed = (await auth_client.get("/api/v1/portfolios")).json()
    assert listed[0]["resumeStatus"] == "draft"


def resume_url(portfolio: dict) -> str:
    return f"/api/v1/public/p/{TEST_SUBDOMAIN}/{portfolio['slug']}/resume"


async def current_resume(auth_client, portfolio: dict) -> dict:
    return (await auth_client.get(f"/api/v1/portfolios/{portfolio['id']}")).json()["resume"]


async def put_resume(auth_client, portfolio: dict, **changes):
    resume = await current_resume(auth_client, portfolio)
    return await auth_client.put(
        f"/api/v1/portfolios/{portfolio['id']}/resume", json={**resume, **changes}
    )


async def test_a_draft_resume_is_404(client, portfolio):
    assert (await client.get(resume_url(portfolio))).status_code == 404


async def test_a_live_resume_is_readable_without_a_token(auth_client, client, portfolio):
    await publish_resume(auth_client, portfolio)
    response = await client.get(resume_url(portfolio))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["header"]["name"] == portfolio["header"]["name"]
    assert body["subdomain"] == TEST_SUBDOMAIN
    assert response.headers["x-robots-tag"] == "noindex, nofollow"


async def test_a_wrong_subdomain_is_404(auth_client, client, portfolio):
    await publish_resume(auth_client, portfolio)
    response = await client.get(f"/api/v1/public/p/nobody/{portfolio['slug']}/resume")
    assert response.status_code == 404


async def test_an_unticked_contact_detail_never_leaves(auth_client, client, portfolio):
    saved = await put_resume(
        auth_client,
        portfolio,
        phone="+91 98000 00000",
        publicContact={"email": True, "phone": False, "location": True, "website": True},
    )
    assert saved.status_code == 200, saved.text
    await publish_resume(auth_client, portfolio)
    response = await client.get(resume_url(portfolio))
    assert response.json()["resume"]["phone"] == ""
    assert "98000" not in response.text


async def test_unticking_while_live_takes_effect(auth_client, client, portfolio):
    await put_resume(auth_client, portfolio, email="me@example.com")
    await publish_resume(auth_client, portfolio)
    first = await client.get(resume_url(portfolio))
    assert first.json()["resume"]["email"] == "me@example.com"

    saved = await put_resume(
        auth_client,
        portfolio,
        email="me@example.com",
        publicContact={"email": False, "phone": True, "location": True, "website": True},
    )
    assert saved.status_code == 200, saved.text
    response = await client.get(resume_url(portfolio))
    assert response.json()["resume"]["email"] == ""


async def test_only_printing_components_are_sent(auth_client, client, portfolio):
    base = f"/api/v1/portfolios/{portfolio['id']}"
    first = portfolio["sections"][0]["id"]
    blocks = [
        {"id": "t1", "type": "text", "onResume": True},
        {"id": "s1", "type": "stats", "items": [], "onResume": False},
    ]
    patched = await auth_client.patch(
        f"{base}/sections/{first}", json={"onResume": True, "blocks": blocks}
    )
    assert patched.status_code == 200, patched.text
    second = (await auth_client.post(f"{base}/sections", json={})).json()["id"]
    await auth_client.patch(f"{base}/sections/{second}", json={"onResume": False})

    await publish_resume(auth_client, portfolio)
    sections = (await client.get(resume_url(portfolio))).json()["sections"]
    assert len(sections) == 1
    assert [b["type"] for b in sections[0]["blocks"]] == ["text"]
    assert sections[0]["images"] == []
    assert sections[0]["hidden"] is False


async def test_header_links_follow_the_website_tick(auth_client, client, portfolio):
    base = f"/api/v1/portfolios/{portfolio['id']}"
    patched = await auth_client.patch(
        f"{base}/header",
        json={"links": [{"id": "l1", "label": "Site", "url": "https://example.com"}]},
    )
    assert patched.status_code == 200, patched.text
    await put_resume(
        auth_client,
        portfolio,
        publicContact={"email": True, "phone": True, "location": True, "website": False},
    )
    await publish_resume(auth_client, portfolio)
    assert (await client.get(resume_url(portfolio))).json()["header"]["links"] == []


async def test_the_portrait_serves_only_while_the_resume_is_live_with_the_photo_on(
    auth_client, client, portfolio
):
    from tests.test_assets import png_bytes, upload

    base = f"/api/v1/portfolios/{portfolio['id']}"
    asset = (await upload(auth_client, png_bytes(600, 600))).json()
    await auth_client.patch(f"{base}/header", json={"portraitAssetId": asset["id"]})
    resume = await current_resume(auth_client, portfolio)
    on = {**resume, "style": {**resume["style"], "photo": True}}
    off = {**resume, "style": {**resume["style"], "photo": False}}
    assert (await auth_client.put(f"{base}/resume", json=on)).status_code == 200

    await publish_resume(auth_client, portfolio)
    assert (await client.get(f"/api/v1/public/assets/{asset['id']}")).status_code == 200
    body = (await client.get(resume_url(portfolio))).json()
    assert body["header"]["portrait"]["url"] == f"/api/v1/public/assets/{asset['id']}"

    await auth_client.post(f"{base}/resume/unpublish")
    assert (await client.get(f"/api/v1/public/assets/{asset['id']}")).status_code == 404

    assert (await auth_client.put(f"{base}/resume", json=off)).status_code == 200
    await publish_resume(auth_client, portfolio)
    assert (await client.get(f"/api/v1/public/assets/{asset['id']}")).status_code == 404


async def put_blocks(auth_client, portfolio: dict, blocks: list[dict]) -> None:
    sid = portfolio["sections"][0]["id"]
    patched = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{sid}",
        json={"onResume": True, "blocks": blocks},
    )
    assert patched.status_code == 200, patched.text


async def test_a_contact_component_follows_the_ticks(auth_client, client, portfolio):
    block = {
        "id": "c1",
        "type": "contact",
        "onResume": True,
        "email": "secret@example.com",
        "phone": "+91 97777 11111",
        "location": "Pune",
    }
    await put_blocks(auth_client, portfolio, [block])
    ticks = {"email": False, "phone": False, "location": True, "website": True}
    await put_resume(auth_client, portfolio, publicContact=ticks)
    await publish_resume(auth_client, portfolio)
    text = (await client.get(resume_url(portfolio))).text
    assert "secret@example.com" not in text
    assert "97777" not in text
    assert "Pune" in text

    base = f"/api/v1/portfolios/{portfolio['id']}"
    await auth_client.post(f"{base}/resume/unpublish")
    await put_resume(auth_client, portfolio, publicContact={**ticks, "email": True, "phone": True})
    await publish_resume(auth_client, portfolio)
    text = (await client.get(resume_url(portfolio))).text
    assert "secret@example.com" in text
    assert "97777" in text


async def test_list_entries_leave_only_through_a_printing_component(auth_client, client, portfolio):
    base = f"/api/v1/portfolios/{portfolio['id']}"
    job = {"id": "e1", "role": "Engineer", "company": "Acme", "bullets": []}
    off = {"id": "x1", "type": "experience", "onResume": False, "items": [job]}
    await put_blocks(auth_client, portfolio, [off])
    await publish_resume(auth_client, portfolio)
    response = await client.get(resume_url(portfolio))
    assert "Acme" not in response.text

    await auth_client.post(f"{base}/resume/unpublish")
    await put_blocks(auth_client, portfolio, [{**off, "onResume": True}])
    await publish_resume(auth_client, portfolio)
    body = (await client.get(resume_url(portfolio))).json()
    [block] = body["sections"][0]["blocks"]
    assert [e["company"] for e in block["items"]] == ["Acme"]
    # The resume's own (pre-component) lists never travel.
    assert body["resume"]["experience"] == []


async def put_section(auth_client, portfolio: dict, **fields) -> None:
    sid = portfolio["sections"][0]["id"]
    patched = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{sid}", json={"onResume": True, **fields}
    )
    assert patched.status_code == 200, patched.text


async def sent_section(auth_client, client, portfolio: dict) -> dict:
    await publish_resume(auth_client, portfolio)
    return (await client.get(resume_url(portfolio))).json()["sections"][0]


FIELD_CASES = [
    ("text", "description", "Secret description", ""),
    ("links", "links", [{"id": "k1", "label": "Site", "url": "https://x.example", "icon": ""}], []),
    ("quote", "quote", {"text": "Secret quote", "attribution": ""}, None),
]


@pytest.mark.parametrize(("kind", "field", "value", "empty"), FIELD_CASES)
async def test_a_section_field_leaves_only_with_a_printing_component(
    auth_client, client, portfolio, kind, field, value, empty
):
    block = {"id": "b1", "type": kind, "onResume": False}
    await put_section(auth_client, portfolio, **{field: value}, blocks=[block])
    section = await sent_section(auth_client, client, portfolio)
    assert section[field] == empty

    await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/resume/unpublish")
    await put_section(auth_client, portfolio, blocks=[{**block, "onResume": True}])
    section = await sent_section(auth_client, client, portfolio)
    assert section[field] == value


async def test_an_unticked_email_takes_every_mailto_with_it(auth_client, client, portfolio):
    base = f"/api/v1/portfolios/{portfolio['id']}"
    mail = {"id": "m1", "label": "Mail", "url": "mailto:Hidden@Example.com"}
    await auth_client.patch(f"{base}/header", json={"links": [mail]})
    await put_section(
        auth_client,
        portfolio,
        links=[mail],
        blocks=[
            {"id": "l1", "type": "links", "onResume": True},
            {
                "id": "c1",
                "type": "contact",
                "onResume": True,
                "ctaLabel": "Write",
                "ctaUrl": "mailto:hidden@example.com",
            },
        ],
    )
    await put_resume(
        auth_client,
        portfolio,
        publicContact={"email": False, "phone": True, "location": True, "website": True},
    )
    await publish_resume(auth_client, portfolio)
    text = (await client.get(resume_url(portfolio))).text
    assert "hidden@example.com" not in text.lower()


async def test_an_unticked_phone_takes_every_tel_with_it(auth_client, client, portfolio):
    base = f"/api/v1/portfolios/{portfolio['id']}"
    call = {"id": "m1", "label": "Call", "url": "tel:+919812300000"}
    await auth_client.patch(f"{base}/header", json={"links": [call]})
    await put_section(
        auth_client,
        portfolio,
        links=[call],
        blocks=[
            {"id": "l1", "type": "links", "onResume": True},
            {"id": "c1", "type": "contact", "onResume": True, "ctaUrl": "tel:+919812300000"},
        ],
    )
    await put_resume(
        auth_client,
        portfolio,
        publicContact={"email": True, "phone": False, "location": True, "website": True},
    )
    await publish_resume(auth_client, portfolio)
    assert "9812300000" not in (await client.get(resume_url(portfolio))).text


async def test_a_hidden_summary_is_not_sent(auth_client, client, portfolio):
    await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/header", json={"description": "Private about"}
    )
    await put_resume(auth_client, portfolio, hidden=["summary"])
    await publish_resume(auth_client, portfolio)
    got = await client.get(resume_url(portfolio))
    assert got.json()["header"]["description"] == ""
    assert "Private about" not in got.text


def test_a_resume_stored_before_the_ticks_reads_as_all_ticked():
    # Raw stored JSON is awkward to write through the API (the schema always
    # fills the key), so this checks the reader the public route uses.
    ticks = resume_from_stored({"email": "a@b.co"}).public_contact
    assert ticks.model_dump() == {"email": True, "phone": True, "location": True, "website": True}
