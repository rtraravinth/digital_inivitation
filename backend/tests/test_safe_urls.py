"""Links whose scheme can run code are emptied, everywhere a URL is stored."""

from __future__ import annotations

import pytest

from app.schemas.common import safe_url


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        " javascript:alert(1)",
        "java\tscript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox",
        "file:///etc/passwd",
    ],
)
def test_a_scheme_that_can_run_code_is_emptied(url):
    assert safe_url(url) == ""


@pytest.mark.parametrize(
    "url",
    [
        "",
        "https://example.com/a?b=c",
        "http://example.com",
        "mailto:rohan@example.com",
        "tel:+919800000000",
        "northwell.in",  # bare host: the frontend adds https://
        "localhost:3000/path",  # a port, not a scheme
        "/relative/path",
    ],
)
def test_ordinary_links_are_kept(url):
    assert safe_url(url) == url


async def test_a_javascript_link_never_reaches_storage(auth_client, portfolio):
    response = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/header",
        json={"links": [{"id": "l1", "label": "x", "url": "javascript:alert(1)"}]},
    )
    assert response.status_code == 200
    assert response.json()["header"]["links"][0]["url"] == ""
