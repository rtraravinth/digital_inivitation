"""Custom domains: the records shown, the DNS check, and what serves.

DNS is faked through ``get_dns_lookup``; the records the fake answers with
are exactly what a person would add at their provider.
"""

from __future__ import annotations

import pytest

from app.core.config import get_settings
from app.core.dns_lookup import get_dns_lookup
from app.services.domains import registered_domain
from tests.factories import TEST_SUBDOMAIN


class FakeDns:
    def __init__(self) -> None:
        self.records: dict[tuple[str, str], list[str]] = {}

    def add(self, rdtype: str, name: str, *values: str) -> None:
        self.records.setdefault((rdtype, name), []).extend(values)

    async def txt(self, name: str) -> list[str]:
        return self.records.get(("TXT", name), [])

    async def cname(self, name: str) -> list[str]:
        return self.records.get(("CNAME", name), [])

    async def a(self, name: str) -> list[str]:
        return self.records.get(("A", name), [])


@pytest.fixture
def dns(app, monkeypatch) -> FakeDns:
    monkeypatch.setattr(get_settings(), "root_domain", "facetfolio.com")
    monkeypatch.setattr(get_settings(), "domain_cname_target", "")
    monkeypatch.setattr(get_settings(), "domain_apex_ips", [])
    fake = FakeDns()
    app.dependency_overrides[get_dns_lookup] = lambda: fake
    return fake


async def set_domain(client, domain: str) -> dict:
    response = await client.patch("/api/v1/account/domain", json={"customDomain": domain})
    assert response.status_code == 200, response.text
    return response.json()


def record(setup: dict, purpose: str) -> dict:
    return next(r for r in setup["records"] if r["purpose"] == purpose)


async def test_no_root_domain_means_no_records(auth_client, monkeypatch):
    monkeypatch.setattr(get_settings(), "root_domain", "")
    body = await set_domain(auth_client, "rohan.dev")
    assert body["customDomain"] == "rohan.dev"
    assert body["domainSetup"] is None


async def test_a_subdomain_of_theirs_gets_a_txt_and_a_cname(auth_client, dns):
    setup = (await set_domain(auth_client, "www.rohan.dev"))["domainSetup"]

    assert setup["verified"] is False
    txt = record(setup, "verify")
    assert txt["type"] == "TXT"
    assert txt["host"] == "_facet-verify.www"
    assert txt["name"] == "_facet-verify.www.rohan.dev"
    assert txt["value"].startswith("facet-verify=")
    assert record(setup, "route") == {
        "type": "CNAME",
        "host": "www",
        "name": "www.rohan.dev",
        "value": "facetfolio.com",
        "purpose": "route",
    }


async def test_a_bare_domain_gets_an_alias_or_the_hosts_a_records(auth_client, dns, monkeypatch):
    setup = (await set_domain(auth_client, "rohan.dev"))["domainSetup"]
    assert record(setup, "verify")["host"] == "_facet-verify"
    assert record(setup, "route")["type"] == "ALIAS"
    assert record(setup, "route")["host"] == "@"

    monkeypatch.setattr(get_settings(), "domain_apex_ips", ["216.24.57.1"])
    setup = (await auth_client.get("/api/v1/account")).json()["domainSetup"]
    assert record(setup, "route")["type"] == "A"
    assert record(setup, "route")["value"] == "216.24.57.1"


def test_a_country_second_level_counts_as_the_bare_domain():
    assert registered_domain("rohan.co.uk") == "rohan.co.uk"
    assert registered_domain("www.rohan.co.uk") == "rohan.co.uk"
    assert registered_domain("www.rohan.dev") == "rohan.dev"


async def test_the_token_is_per_account_and_per_domain(auth_client, other_auth_client, dns):
    mine = record((await set_domain(auth_client, "rohan.dev"))["domainSetup"], "verify")
    theirs = record((await set_domain(other_auth_client, "rohan.dev"))["domainSetup"], "verify")
    other = record((await set_domain(auth_client, "rohan.io"))["domainSetup"], "verify")
    assert len({mine["value"], theirs["value"], other["value"]}) == 3


@pytest.mark.parametrize("bad", ["rohan", "rohan dev.com", "-rohan.dev", "rohan.dev/page/extra?x"])
async def test_a_malformed_domain_is_422(auth_client, bad):
    response = await auth_client.patch("/api/v1/account/domain", json={"customDomain": bad})
    if "/" in bad:
        # A pasted address loses its path rather than failing.
        assert response.json()["customDomain"] == "rohan.dev"
    else:
        assert response.status_code == 422


async def test_our_own_domain_cannot_be_a_custom_one(auth_client, dns):
    response = await auth_client.patch(
        "/api/v1/account/domain", json={"customDomain": "someone.facetfolio.com"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "domain_reserved"


async def test_the_txt_record_verifies_and_the_domain_serves(auth_client, client, dns):
    setup = (await set_domain(auth_client, "www.rohan.dev"))["domainSetup"]
    assert (await client.get("/api/v1/public/domains/www.rohan.dev")).status_code == 404

    dns.add("TXT", "_facet-verify.www.rohan.dev", "unrelated", record(setup, "verify")["value"])
    body = (await auth_client.post("/api/v1/account/domain/verify")).json()
    assert body["domainSetup"]["verified"] is True
    assert body["domainSetup"]["verifiedAt"]
    assert body["domainSetup"]["routingOk"] is False

    owner = await client.get("/api/v1/public/domains/www.rohan.dev")
    assert owner.status_code == 200
    assert owner.json() == {"subdomain": TEST_SUBDOMAIN}


async def test_routing_is_reported_by_cname_or_by_address(auth_client, dns):
    setup = (await set_domain(auth_client, "www.rohan.dev"))["domainSetup"]
    dns.add("TXT", "_facet-verify.www.rohan.dev", record(setup, "verify")["value"])
    dns.add("CNAME", "www.rohan.dev", "facetfolio.com")
    body = (await auth_client.post("/api/v1/account/domain/verify")).json()
    assert body["domainSetup"]["routingOk"] is True

    setup = (await set_domain(auth_client, "rohan.dev"))["domainSetup"]
    dns.add("TXT", "_facet-verify.rohan.dev", record(setup, "verify")["value"])
    dns.add("A", "facetfolio.com", "216.24.57.1")
    dns.add("A", "rohan.dev", "216.24.57.1")
    body = (await auth_client.post("/api/v1/account/domain/verify")).json()
    assert body["domainSetup"]["routingOk"] is True


async def test_someone_elses_token_does_not_verify(auth_client, other_auth_client, dns):
    theirs = record((await set_domain(other_auth_client, "rohan.dev"))["domainSetup"], "verify")
    await set_domain(auth_client, "rohan.dev")
    dns.add("TXT", "_facet-verify.rohan.dev", theirs["value"])

    body = (await auth_client.post("/api/v1/account/domain/verify")).json()
    assert body["domainSetup"]["verified"] is False


async def test_one_account_holds_a_domain_verified(auth_client, other_auth_client, dns):
    mine = record((await set_domain(auth_client, "rohan.dev"))["domainSetup"], "verify")
    theirs = record((await set_domain(other_auth_client, "rohan.dev"))["domainSetup"], "verify")
    dns.add("TXT", "_facet-verify.rohan.dev", mine["value"], theirs["value"])

    assert (await auth_client.post("/api/v1/account/domain/verify")).status_code == 200
    response = await other_auth_client.post("/api/v1/account/domain/verify")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "domain_taken"


async def test_changing_the_domain_drops_the_verification(auth_client, client, dns):
    setup = (await set_domain(auth_client, "rohan.dev"))["domainSetup"]
    dns.add("TXT", "_facet-verify.rohan.dev", record(setup, "verify")["value"])
    await auth_client.post("/api/v1/account/domain/verify")

    body = await set_domain(auth_client, "rohan.io")
    assert body["domainSetup"]["verified"] is False
    assert (await client.get("/api/v1/public/domains/rohan.dev")).status_code == 404


async def test_a_removed_txt_record_unverifies(auth_client, client, dns):
    setup = (await set_domain(auth_client, "rohan.dev"))["domainSetup"]
    dns.add("TXT", "_facet-verify.rohan.dev", record(setup, "verify")["value"])
    await auth_client.post("/api/v1/account/domain/verify")

    dns.records.clear()
    body = (await auth_client.post("/api/v1/account/domain/verify")).json()
    assert body["domainSetup"]["verified"] is False
    assert (await client.get("/api/v1/public/domains/rohan.dev")).status_code == 404


async def test_checking_with_no_domain_is_404(auth_client, dns):
    response = await auth_client.post("/api/v1/account/domain/verify")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "no_domain"
