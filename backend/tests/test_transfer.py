"""Export and import, including data taken from the localStorage build."""

from __future__ import annotations

import base64
import io

from PIL import Image


def legacy_data_url() -> str:
    buffer = io.BytesIO()
    Image.new("RGB", (250, 250), (5, 5, 5)).save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


def legacy_export() -> list[dict]:
    """One portfolio in exactly the shape src/lib/store.tsx exports."""
    return [
        {
            "id": "old-1",
            "name": "Legacy",
            "slug": "legacy-x",
            "status": "draft",
            "summary": "",
            "meta": "1 section · just now",
            "theme": "editorial",
            "accent": "#ec3013",
            "ground": "light",
            "font": "archivo",
            "layout": {
                "roleNav": "tabs",
                "grid": 2,
                "density": "standard",
                "scale": "default",
                "tracking": "-0.015em",
            },
            "header": {
                "name": "L",
                "current": "",
                "description": "",
                "tags": [],
                "links": [],
                "portrait": None,
            },
            "sections": [
                {
                    "id": "s1",
                    "title": "With an image",
                    "description": "",
                    "tags": ["Old"],
                    "links": [],
                    "numbers": [],
                    "dates": [],
                    "quote": None,
                    "hidden": False,
                    "kind": "gallery",
                    "image": {
                        "name": "old.png",
                        "mime": "image/png",
                        "dataUrl": legacy_data_url(),
                        "size": 1234,
                    },
                    "file": None,
                }
            ],
        }
    ]


async def test_export_then_import_replace_roundtrips(auth_client):
    await auth_client.post(
        "/api/v1/portfolios",
        json={"name": "F", "slug": "round-trip", "startFrom": {"kind": "founder"}},
    )

    exported = (await auth_client.get("/api/v1/export")).json()
    assert isinstance(exported, list)
    assert len(exported) == 1
    assert len(exported[0]["sections"]) == 3

    response = await auth_client.post(
        "/api/v1/import", json={"mode": "replace", "portfolios": exported}
    )
    assert response.status_code == 200
    assert response.json()["imported"] == 1

    again = (await auth_client.get("/api/v1/export")).json()
    assert [s["title"] for s in again[0]["sections"]] == [
        s["title"] for s in exported[0]["sections"]
    ]
    assert again[0]["slug"] == exported[0]["slug"]


async def test_import_replace_removes_what_was_there(auth_client, portfolio):
    response = await auth_client.post(
        "/api/v1/import", json={"mode": "replace", "portfolios": []}
    )
    assert response.json()["imported"] == 0
    assert (await auth_client.get("/api/v1/portfolios")).json() == []


async def test_import_merge_keeps_both_and_renames_a_clashing_slug(auth_client, portfolio):
    exported = (await auth_client.get("/api/v1/export")).json()

    response = await auth_client.post(
        "/api/v1/import", json={"mode": "merge", "portfolios": exported}
    )
    assert response.status_code == 200
    assert response.json()["imported"] == 1
    assert response.json()["renamed"] == {"rohan": "rohan-2"}

    slugs = sorted(p["slug"] for p in (await auth_client.get("/api/v1/portfolios")).json())
    assert slugs == ["rohan", "rohan-2"]


async def test_import_mints_new_ids(auth_client, portfolio):
    exported = (await auth_client.get("/api/v1/export")).json()
    await auth_client.post("/api/v1/import", json={"mode": "merge", "portfolios": exported})

    rows = (await auth_client.get("/api/v1/portfolios")).json()
    assert len({row["id"] for row in rows}) == 2


async def test_a_legacy_export_with_a_data_uri_becomes_a_real_asset(auth_client):
    response = await auth_client.post(
        "/api/v1/import", json={"mode": "merge", "portfolios": legacy_export()}
    )
    assert response.status_code == 200

    imported = next(
        p for p in (await auth_client.get("/api/v1/portfolios")).json()
        if p["slug"] == "legacy-x"
    )
    full = (await auth_client.get(f"/api/v1/portfolios/{imported['id']}")).json()

    image = full["sections"][0]["image"]
    assert image is not None
    assert image["url"].startswith("/api/v1/assets/")
    # The data URI is gone: it is a real file now.
    assert "dataUrl" not in image
    assert image["mime"] == "image/jpeg"

    # And the bytes are actually there.
    assert (await auth_client.get(image["url"])).status_code == 200


async def test_a_legacy_export_keeps_its_content(auth_client):
    await auth_client.post(
        "/api/v1/import", json={"mode": "merge", "portfolios": legacy_export()}
    )
    imported = next(
        p for p in (await auth_client.get("/api/v1/portfolios")).json()
        if p["slug"] == "legacy-x"
    )
    full = (await auth_client.get(f"/api/v1/portfolios/{imported['id']}")).json()

    assert full["name"] == "Legacy"
    assert full["sections"][0]["title"] == "With an image"
    assert full["sections"][0]["tab"] == "Old"
    # `kind` is in the payload and is simply ignored: sections no longer
    # have a type, and an old export must still import.
    assert "kind" not in full["sections"][0]


async def test_a_legacy_exports_section_numbers_move_up_to_the_header(auth_client):
    """An export from the build that stored them per section still reads.

    The page gathered every section's entries into one row and one timeline,
    so that is what the header gets, in section order.
    """
    payload = legacy_export()
    payload[0]["slug"] = "legacy-extras"
    payload[0]["sections"][0]["numbers"] = [{"id": "n1", "label": "Cities", "value": "3"}]
    payload[0]["sections"][0]["dates"] = [{"id": "d1", "year": "2021", "text": "Founded"}]

    await auth_client.post("/api/v1/import", json={"mode": "merge", "portfolios": payload})
    imported = next(
        p for p in (await auth_client.get("/api/v1/portfolios")).json()
        if p["slug"] == "legacy-extras"
    )
    full = (await auth_client.get(f"/api/v1/portfolios/{imported['id']}")).json()

    assert full["header"]["numbers"][0]["value"] == "3"
    assert full["header"]["dates"][0]["year"] == "2021"


async def test_an_export_writes_numbers_and_the_timeline_on_the_header(auth_client, portfolio):
    await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/header",
        json={"numbers": [{"id": "n1", "label": "Cities", "value": "3"}]},
    )

    exported = (await auth_client.get("/api/v1/export")).json()
    mine = next(p for p in exported if p["slug"] == portfolio["slug"])

    assert mine["header"]["numbers"][0]["value"] == "3"
    assert "numbers" not in mine["sections"][0]


async def test_a_legacy_export_with_no_tags_lands_on_the_default_tab(auth_client):
    payload = legacy_export()
    payload[0]["slug"] = "legacy-untagged"
    payload[0]["sections"][0]["tags"] = []

    await auth_client.post("/api/v1/import", json={"mode": "merge", "portfolios": payload})
    imported = next(
        p for p in (await auth_client.get("/api/v1/portfolios")).json()
        if p["slug"] == "legacy-untagged"
    )
    full = (await auth_client.get(f"/api/v1/portfolios/{imported['id']}")).json()

    assert full["sections"][0]["tab"] == "Work"


async def test_an_unknown_theme_in_an_import_falls_back(auth_client):
    payload = legacy_export()
    payload[0]["theme"] = "a-theme-we-dropped"
    payload[0]["slug"] = "dropped-theme"

    await auth_client.post("/api/v1/import", json={"mode": "merge", "portfolios": payload})

    imported = next(
        p for p in (await auth_client.get("/api/v1/portfolios")).json()
        if p["slug"] == "dropped-theme"
    )
    assert imported["theme"] == "editorial"


async def test_a_custom_ground_survives_an_export_and_import(auth_client, portfolio):
    await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}", json={"groundHex": "#2b3a67"}
    )
    exported = (await auth_client.get("/api/v1/export")).json()

    await auth_client.post(
        "/api/v1/import", json={"mode": "replace", "portfolios": exported}
    )

    restored = (await auth_client.get("/api/v1/portfolios")).json()[0]
    assert restored["groundHex"] == "#2b3a67"


async def test_both_faces_survive_an_export_and_import(auth_client, portfolio):
    await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}",
        json={"font": "syne", "bodyFont": "lora"},
    )
    exported = (await auth_client.get("/api/v1/export")).json()
    await auth_client.post(
        "/api/v1/import", json={"mode": "replace", "portfolios": exported}
    )

    restored = (await auth_client.get("/api/v1/portfolios")).json()[0]
    assert restored["font"] == "syne"
    assert restored["bodyFont"] == "lora"


async def test_a_legacy_export_with_no_body_font_lands_on_archivo(auth_client):
    """Anything exported before the column existed has no bodyFont at all."""
    payload = legacy_export()
    payload[0]["slug"] = "no-body-font"
    assert "bodyFont" not in payload[0]

    await auth_client.post("/api/v1/import", json={"mode": "merge", "portfolios": payload})

    imported = next(
        p for p in (await auth_client.get("/api/v1/portfolios")).json()
        if p["slug"] == "no-body-font"
    )
    assert imported["bodyFont"] == "archivo"


async def test_a_junk_ground_colour_in_an_import_falls_back(auth_client):
    """The value lands in a style attribute, so anything but #rrggbb is dropped."""
    payload = legacy_export()
    payload[0]["groundHex"] = "red; background-image: url(x)"
    payload[0]["slug"] = "junk-ground"

    await auth_client.post("/api/v1/import", json={"mode": "merge", "portfolios": payload})

    imported = next(
        p for p in (await auth_client.get("/api/v1/portfolios")).json()
        if p["slug"] == "junk-ground"
    )
    assert imported["groundHex"] == ""


async def test_a_corrupt_data_uri_does_not_fail_the_import(auth_client):
    payload = legacy_export()
    payload[0]["sections"][0]["image"]["dataUrl"] = "data:image/png;base64,!!!not-base64!!!"

    response = await auth_client.post(
        "/api/v1/import", json={"mode": "merge", "portfolios": payload}
    )
    assert response.status_code == 200

    imported = next(
        p for p in (await auth_client.get("/api/v1/portfolios")).json()
        if p["slug"] == "legacy-x"
    )
    full = (await auth_client.get(f"/api/v1/portfolios/{imported['id']}")).json()
    # The section survives; only the attachment is dropped.
    assert full["sections"][0]["title"] == "With an image"
    assert full["sections"][0]["image"] is None


async def test_import_rejects_a_payload_that_is_not_a_portfolio_list(auth_client):
    response = await auth_client.post(
        "/api/v1/import", json={"mode": "replace", "portfolios": ["nope", 1]}
    )
    assert response.status_code == 422

    error = response.json()["error"]
    assert error["code"] == "validation_failed"
    # The schema catches this before the service does, and says which entry.
    assert any(field["field"].startswith("portfolios.") for field in error["details"]["fields"])


async def test_import_rejects_a_payload_that_is_not_a_list_at_all(auth_client):
    response = await auth_client.post(
        "/api/v1/import", json={"mode": "replace", "portfolios": {"nope": 1}}
    )
    assert response.status_code == 422


async def test_import_with_no_portfolios_key_is_a_no_op_not_an_error(auth_client, portfolio):
    response = await auth_client.post("/api/v1/import", json={"mode": "merge"})
    assert response.status_code == 200
    assert response.json()["imported"] == 0
    assert len((await auth_client.get("/api/v1/portfolios")).json()) == 1


async def test_import_never_touches_another_users_data(auth_client, other_auth_client):
    theirs = (
        await other_auth_client.post(
            "/api/v1/portfolios",
            json={"name": "T", "slug": "theirs-keep", "startFrom": {"kind": "blank"}},
        )
    ).json()

    await auth_client.post("/api/v1/import", json={"mode": "replace", "portfolios": []})

    still = (await other_auth_client.get("/api/v1/portfolios")).json()
    assert [row["id"] for row in still] == [theirs["id"]]


async def test_export_only_returns_my_portfolios(auth_client, other_auth_client, portfolio):
    await other_auth_client.post(
        "/api/v1/portfolios",
        json={"name": "T", "slug": "theirs-export", "startFrom": {"kind": "blank"}},
    )

    exported = (await auth_client.get("/api/v1/export")).json()
    assert [row["slug"] for row in exported] == ["rohan"]


async def test_export_requires_a_token(client):
    client.headers.pop("Authorization", None)
    assert (await client.get("/api/v1/export")).status_code == 401
