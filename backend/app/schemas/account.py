"""Account settings.

``AccountOut`` mirrors ``AccountSettings`` in src/lib/types.ts field for
field, so the Account page consumes it with no mapping layer.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import EmailStr, Field, field_validator

from app.models.enums import PlanId
from app.schemas.asset import AssetOut
from app.schemas.common import CamelModel, SafeUrl, StrictCamelModel

SUBDOMAIN_PATTERN = r"^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$"

#: Subdomains that can never be claimed, because the address is
#: ``<subdomain>.facetfolio.com/<slug>`` and these are, or may become, something else
#: at that position — an app route, a hostname, or a word a support page will
#: want. This list can only ever grow: once an account holds a subdomain, taking
#: it back breaks every link already shared, so anything doubtful belongs here
#: on the first day rather than the second.
RESERVED_SUBDOMAINS: frozenset[str] = frozenset(
    {
        # routes this app already serves
        "account",
        "stats",
        "signin",
        "signout",
        "signup",
        "p",
        "print",
        "editor",
        "builder",
        "themes",
        "blocks",
        "portfolios",
        # hostnames and infrastructure
        "api",
        "www",
        "app",
        "admin",
        "cdn",
        "static",
        "assets",
        "media",
        "mail",
        "smtp",
        "imap",
        "ftp",
        "ns",
        "ns1",
        "ns2",
        "webmail",
        "status",
        # the product itself
        "facet",
        "official",
        "team",
        "staff",
        "support",
        "help",
        "root",
        "system",
        "security",
        "billing",
        "legal",
        "privacy",
        "terms",
        # things a marketing site grows
        "about",
        "blog",
        "docs",
        "pricing",
        "careers",
        "press",
        "contact",
        "login",
        "logout",
        "register",
        "settings",
        "dashboard",
        "explore",
        "new",
        "edit",
        "me",
        "you",
        "null",
        "undefined",
        "true",
        "false",
    }
)


class LinkItem(StrictCamelModel):
    id: str = Field(max_length=64)
    label: str = Field(default="", max_length=200)
    url: SafeUrl = ""
    #: Overrides the icon the frontend would work out from `url`. Empty means
    #: "decide from the address", which is what almost every link wants. Not
    #: constrained to a known set: an id this build does not recognise renders
    #: the generic glyph, the same way an unknown theme falls back to Editorial.
    icon: str = Field(default="", max_length=32)


class ProfileOut(CamelModel):
    name: str
    subdomain: str | None
    current: str
    about: str
    tags: list[str]
    links: list[LinkItem]
    portrait: AssetOut | None


class SecurityOut(CamelModel):
    """Never carries a credential. Firebase holds every one of them."""

    #: None for an account made with a phone number.
    email: EmailStr | None
    phone: str
    google: bool
    #: How the account last signed in, as Firebase names it.
    sign_in_provider: str


class DnsRecordOut(CamelModel):
    """One record to add at the domain's DNS provider."""

    type: Literal["TXT", "CNAME", "A", "ALIAS"]
    #: What a DNS provider's "Host" or "Name" field wants: relative to the
    #: registered domain, "@" for the domain itself.
    host: str
    #: The same name written out in full.
    name: str
    value: str
    purpose: Literal["verify", "route"]


class DomainSetupOut(CamelModel):
    domain: str
    verified: bool
    verified_at: datetime | None
    records: list[DnsRecordOut]
    #: Only on a check's answer: whether the domain already resolves to us.
    #: Null otherwise — nothing is looked up to read the account.
    routing_ok: bool | None = None


class AccountOut(CamelModel):
    profile: ProfileOut
    security: SecurityOut
    plan: PlanId
    custom_domain: str
    #: Null with no domain set, or when this server has no root domain to
    #: point one at (``FACET_ROOT_DOMAIN``).
    domain_setup: DomainSetupOut | None
    notifications: dict[str, bool]
    privacy: dict[str, bool]


class ProfilePatch(StrictCamelModel):
    name: str | None = Field(default=None, max_length=200)
    subdomain: str | None = Field(default=None, pattern=SUBDOMAIN_PATTERN)
    current: str | None = Field(default=None, max_length=2000)
    about: str | None = Field(default=None, max_length=5000)
    tags: list[str] | None = Field(default=None, max_length=40)
    links: list[LinkItem] | None = Field(default=None, max_length=40)
    portrait_asset_id: uuid.UUID | None = None
    # Distinguishes "leave the portrait alone" from "remove it": the id field
    # alone cannot, because null is a legitimate value for both.
    clear_portrait: bool = False


class SecurityPatch(StrictCamelModel):
    phone: str | None = Field(default=None, max_length=32)
    google: bool | None = None


class PlanPatch(StrictCamelModel):
    plan: PlanId


#: A hostname of two labels or more, ASCII (punycode for anything else).
DOMAIN_PATTERN = re.compile(
    r"^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$"
)


class DomainPatch(StrictCamelModel):
    custom_domain: str = Field(default="", max_length=255)

    @field_validator("custom_domain")
    @classmethod
    def _tidy(cls, value: str) -> str:
        value = value.strip().lower().removeprefix("https://").removeprefix("http://")
        value = value.split("/", 1)[0].rstrip(".")
        if value and not DOMAIN_PATTERN.match(value):
            raise ValueError("Enter a domain like yourname.com, without a path.")
        return value


class NotificationsPatch(StrictCamelModel):
    """Every key optional, unknown keys rejected.

    A misspelled key silently ignored looks exactly like a save that did
    nothing, which is the worst possible outcome for a settings toggle.
    """

    booking: bool | None = None
    weekly: bool | None = None
    broken_link: bool | None = None
    mention: bool | None = None
    product: bool | None = None


class PrivacyPatch(StrictCamelModel):
    indexable: bool | None = None
    show_contact: bool | None = None
    count_visits: bool | None = None
    badge: bool | None = None
