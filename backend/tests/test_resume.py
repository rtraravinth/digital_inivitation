"""The resume a portfolio downloads as."""

from __future__ import annotations

from tests.factories import TEST_HANDLE

FULL_RESUME = {
    "email": "rohan@example.com",
    "phone": "+91 98000 00000",
    "location": "Bengaluru",
    "website": "https://example.com",
    "experience": [
        {
            "id": "e1",
            "role": "Founder & CEO",
            "company": "Northwell Kitchens",
            "location": "Bengaluru",
            "start": "2019",
            "end": "",
            "current": True,
            "bullets": ["Grew to eleven brands", "Profitable since 2022"],
        }
    ],
    "education": [
        {"id": "d1", "degree": "B.Com", "school": "Christ University", "start": "2010", "end": "2013"}
    ],
    "skills": [{"id": "s1", "name": "Operations", "items": ["P&L", "Hiring"]}],
    "certifications": [{"id": "c1", "name": "SEBI RIA", "issuer": "SEBI", "date": "2021"}],
    "languages": [{"id": "l1", "name": "Hindi", "level": "Native"}],
    "awards": [],
    "order": ["experience", "summary", "education", "projects", "skills",
              "certifications", "languages", "awards"],
    "hidden": ["awards"],
    "style": {
        "template": "sidebar",
        "paper": "letter",
        "accent": "#0f766e",
        "headingFont": "fraunces",
        "font": "source-serif-4",
        "size": "small",
        "spacing": "compact",
        "photo": True,
    },
}


async def test_a_new_portfolio_has_the_default_resume(auth_client, portfolio):
    resume = (await auth_client.get(f"/api/v1/portfolios/{portfolio['id']}")).json()["resume"]

    assert resume["experience"] == []
    assert resume["style"]["template"] == "classic"
    assert resume["style"]["paper"] == "a4"
    assert resume["order"][0] == "summary"
    assert len(resume["order"]) == 8


async def test_put_replaces_the_resume_and_reads_back(auth_client, portfolio):
    response = await auth_client.put(f"/api/v1/portfolios/{portfolio['id']}/resume", json=FULL_RESUME)
    assert response.status_code == 200

    resume = (await auth_client.get(f"/api/v1/portfolios/{portfolio['id']}")).json()["resume"]
    assert resume["experience"][0]["company"] == "Northwell Kitchens"
    assert resume["experience"][0]["current"] is True
    assert resume["order"][0] == "experience"
    assert resume["hidden"] == ["awards"]
    assert resume["style"]["headingFont"] == "fraunces"


async def _publish_with_resume(auth_client, portfolio) -> dict:
    await auth_client.put(f"/api/v1/portfolios/{portfolio['id']}/resume", json=FULL_RESUME)
    return (await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/publish")).json()


async def test_a_live_portfolio_takes_style_and_contact_edits(auth_client, portfolio):
    live = await _publish_with_resume(auth_client, portfolio)
    # The template, which blocks print and the contact details never reach
    # the page, so the freeze has nothing to protect there.
    edited = {
        **FULL_RESUME,
        "email": "new@example.com",
        "hidden": [],
        "style": {**FULL_RESUME["style"], "template": "ivy"},
    }
    response = await auth_client.put(f"/api/v1/portfolios/{live['id']}/resume", json=edited)
    assert response.status_code == 200
    assert response.json()["status"] == "live"


async def test_a_live_portfolio_refuses_edits_that_reach_the_page(auth_client, portfolio):
    live = await _publish_with_resume(auth_client, portfolio)
    url = f"/api/v1/portfolios/{live['id']}/resume"

    new_role = {**FULL_RESUME, "experience": [{**FULL_RESUME["experience"][0], "role": "CEO"}]}
    assert (await auth_client.put(url, json=new_role)).status_code == 409

    reordered = {**FULL_RESUME, "order": list(reversed(FULL_RESUME["order"]))}
    response = await auth_client.put(url, json=reordered)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "portfolio_published"


def _list(kind: str, look: str = "list") -> dict:
    return {"id": f"c-{kind}", "type": kind, "title": "", "look": look}


async def _place(auth_client, portfolio, index: int, kinds: list[str], **patch) -> None:
    """Put resume-list components in one of the portfolio's sections."""
    section = portfolio["sections"][index]
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section['id']}",
        json={"blocks": [_list(kind) for kind in kinds], **patch},
    )
    assert response.status_code == 200, response.text


async def test_a_resume_list_is_a_component(auth_client, portfolio):
    section = portfolio["sections"][0]
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section['id']}",
        json={"blocks": [_list("experience", "timeline"), {"id": "s", "type": "skills"}]},
    )
    assert response.status_code == 200, response.text
    blocks = response.json()["blocks"]
    assert blocks[0] == {"id": "c-experience", "type": "experience", "title": "", "look": "timeline"}
    # The look has a default, and the component carries no entries of its own.
    assert blocks[1] == {"id": "s", "type": "skills", "title": "", "look": "theme"}


async def test_a_resume_list_component_holds_no_entries(auth_client, portfolio):
    section = portfolio["sections"][0]
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section['id']}",
        json={"blocks": [{**_list("experience"), "items": FULL_RESUME["experience"]}]},
    )
    assert response.status_code == 422


async def test_the_public_page_gets_only_the_lists_placed_on_it(client, auth_client, portfolio):
    await _place(auth_client, portfolio, 0, ["experience", "skills"])
    live = await _publish_with_resume(auth_client, portfolio)

    response = await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{live['slug']}")
    assert response.status_code == 200
    resume = response.json()["resume"]
    assert resume["experience"][0]["company"] == "Northwell Kitchens"
    assert resume["skills"][0]["items"] == ["P&L", "Hiring"]
    # Kept to the resume, so absent from the page.
    assert resume["languages"] == []
    assert resume["certifications"] == []
    # Contact details and the template never leave the account.
    assert "email" not in resume and "style" not in resume
    assert "rohan@example.com" not in response.text
    assert "+91 98000" not in response.text


async def test_a_list_placed_nowhere_never_leaves_the_account(client, auth_client, portfolio):
    live = await _publish_with_resume(auth_client, portfolio)

    response = await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{live['slug']}")
    assert all(entries == [] for entries in response.json()["resume"].values())
    assert "Northwell Kitchens" not in response.text


async def test_a_list_in_a_hidden_section_never_leaves_the_account(client, auth_client, portfolio):
    """The component is what places a list on the page, and a hidden section
    is not on the page."""
    await _place(auth_client, portfolio, 0, ["experience"], hidden=True)
    live = await _publish_with_resume(auth_client, portfolio)

    response = await client.get(f"/api/v1/public/p/{TEST_HANDLE}/{live['slug']}")
    assert response.json()["resume"]["experience"] == []
    assert "Northwell Kitchens" not in response.text


async def test_a_stored_page_blocks_key_does_not_break_a_read(auth_client, portfolio, db_session):
    """`pageBlocks` was how a list reached the page before components did."""
    from sqlalchemy import text

    await db_session.execute(
        text("UPDATE portfolios SET resume = CAST(:r AS jsonb) WHERE id = :id"),
        {"r": '{"pageBlocks": ["experience"], "email": "kept@example.com"}', "id": portfolio["id"]},
    )
    resume = (await auth_client.get(f"/api/v1/portfolios/{portfolio['id']}")).json()["resume"]
    assert resume["email"] == "kept@example.com"
    assert "pageBlocks" not in resume


async def test_old_headline_and_summary_keys_do_not_break_a_read(auth_client, portfolio, db_session):
    from sqlalchemy import text

    await db_session.execute(
        text("UPDATE portfolios SET resume = CAST(:r AS jsonb) WHERE id = :id"),
        {"r": '{"headline": "Old", "summary": "Old", "email": "kept@example.com"}', "id": portfolio["id"]},
    )
    resume = (await auth_client.get(f"/api/v1/portfolios/{portfolio['id']}")).json()["resume"]
    assert resume["email"] == "kept@example.com"
    assert "headline" not in resume


async def test_a_section_prints_on_the_resume_unless_switched_off(auth_client, portfolio):
    section = portfolio["sections"][0]
    assert section["onResume"] is True

    url = f"/api/v1/portfolios/{portfolio['id']}/sections/{section['id']}"
    response = await auth_client.patch(url, json={"onResume": False})
    assert response.status_code == 200
    assert response.json()["onResume"] is False
    assert response.json()["hidden"] is False


async def test_unknown_fields_and_values_are_refused(auth_client, portfolio):
    url = f"/api/v1/portfolios/{portfolio['id']}/resume"

    bad_template = {**FULL_RESUME, "style": {**FULL_RESUME["style"], "template": "netflix"}}
    assert (await auth_client.put(url, json=bad_template)).status_code == 422

    bad_accent = {**FULL_RESUME, "style": {**FULL_RESUME["style"], "accent": "teal"}}
    assert (await auth_client.put(url, json=bad_accent)).status_code == 422

    assert (await auth_client.put(url, json={**FULL_RESUME, "salary": "1"})).status_code == 422


async def test_another_account_cannot_touch_the_resume(other_auth_client, portfolio):
    response = await other_auth_client.put(
        f"/api/v1/portfolios/{portfolio['id']}/resume", json=FULL_RESUME
    )
    assert response.status_code == 404


async def test_a_copy_takes_the_resume_along(auth_client, portfolio):
    await auth_client.put(f"/api/v1/portfolios/{portfolio['id']}/resume", json=FULL_RESUME)

    copy = (
        await auth_client.post(
            "/api/v1/portfolios",
            json={"name": "Copy", "slug": "copy-resume", "startFrom": {"kind": "copy", "id": portfolio["id"]}},
        )
    ).json()
    assert copy["resume"]["experience"][0]["role"] == "Founder & CEO"
    assert copy["resume"]["style"]["template"] == "sidebar"


async def test_export_and_import_carry_the_resume(auth_client, portfolio):
    await auth_client.put(f"/api/v1/portfolios/{portfolio['id']}/resume", json=FULL_RESUME)

    exported = (await auth_client.get("/api/v1/export")).json()
    assert exported[0]["resume"]["email"] == "rohan@example.com"

    imported = await auth_client.post("/api/v1/import", json={"mode": "replace", "portfolios": exported})
    assert imported.status_code in (200, 201)
    rows = (await auth_client.get("/api/v1/portfolios?expand=sections")).json()
    assert rows[0]["resume"]["languages"][0]["name"] == "Hindi"


async def test_an_import_with_a_broken_resume_lands_on_the_defaults(auth_client, portfolio):
    exported = (await auth_client.get("/api/v1/export")).json()
    exported[0]["resume"] = {"style": {"template": "retired-template"}}

    imported = await auth_client.post("/api/v1/import", json={"mode": "replace", "portfolios": exported})
    assert imported.status_code in (200, 201)
    rows = (await auth_client.get("/api/v1/portfolios?expand=sections")).json()
    assert rows[0]["resume"]["style"]["template"] == "classic"


def test_the_template_list_matches_the_frontend():
    # A template only the frontend knows is a 422 on the first save after
    # someone picks it. The two lists are kept by hand, so pin them together.
    import re
    from pathlib import Path
    from typing import get_args

    from app.schemas.resume import ResumeTemplate

    types_ts = Path(__file__).resolve().parents[2] / "src" / "lib" / "types.ts"
    block = re.search(r"RESUME_TEMPLATE_IDS = \[(.*?)\] as const", types_ts.read_text(encoding="utf-8"), re.S)
    assert block, "RESUME_TEMPLATE_IDS not found in src/lib/types.ts"
    assert re.findall(r'"([a-z-]+)"', block.group(1)) == list(get_args(ResumeTemplate))


async def test_every_template_saves(auth_client, portfolio):
    from typing import get_args

    from app.schemas.resume import ResumeTemplate

    url = f"/api/v1/portfolios/{portfolio['id']}/resume"
    for template in get_args(ResumeTemplate):
        body = {**FULL_RESUME, "style": {**FULL_RESUME["style"], "template": template}}
        res = await auth_client.put(url, json=body)
        assert res.status_code == 200, template
        assert res.json()["resume"]["style"]["template"] == template


async def test_columns_and_background_save_and_unknown_ones_are_refused(auth_client, portfolio):
    url = f"/api/v1/portfolios/{portfolio['id']}/resume"
    body = {**FULL_RESUME, "style": {**FULL_RESUME["style"], "columns": "half", "backdrop": "hexagons"}}
    res = await auth_client.put(url, json=body)
    assert res.status_code == 200
    assert res.json()["resume"]["style"]["columns"] == "half"
    assert res.json()["resume"]["style"]["backdrop"] == "hexagons"

    for bad in ({"columns": "three"}, {"backdrop": "glitter"}):
        res = await auth_client.put(url, json={**FULL_RESUME, "style": {**FULL_RESUME["style"], **bad}})
        assert res.status_code == 422


def test_the_background_list_matches_the_frontend():
    import re
    from pathlib import Path
    from typing import get_args

    from app.schemas.resume import ResumeBackdrop

    types_ts = Path(__file__).resolve().parents[2] / "src" / "lib" / "types.ts"
    block = re.search(r"RESUME_BACKDROP_IDS = \[(.*?)\] as const", types_ts.read_text(encoding="utf-8"), re.S)
    assert block
    assert re.findall(r'"([a-z-]+)"', block.group(1)) == list(get_args(ResumeBackdrop))
