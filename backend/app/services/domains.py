"""Custom domains: the records to add, and the check that they are there.

An owner types a domain they bought; the account page shows two records:

- a TXT record at ``_facet-verify.<domain>`` holding a token derived from
  the account and the domain — proof the person controls its DNS, and
- a CNAME (A or ALIAS at a bare domain) pointing the name at this service.

"Check DNS" looks both up. The TXT record is what verifies: only a verified
domain serves pages (``GET /public/domains/{domain}``), and only one account
can hold a domain verified. The routing record is reported, not required —
DNS takes time, and the person should not have to verify twice.

The token is an HMAC of the account and the domain under the JWT secret, so
there is nothing to store, it cannot be guessed for someone else's account,
and changing the domain changes it.
"""

from __future__ import annotations

import hashlib
import hmac
import uuid

from app.core.config import get_settings
from app.core.dns_lookup import DnsLookup
from app.schemas.account import DnsRecordOut

VERIFY_LABEL = "_facet-verify"
TOKEN_PREFIX = "facet-verify="  # noqa: S105 — a record label, not a secret

#: Second-level labels under a two-letter country code that are themselves a
#: registry suffix (``example.co.uk``). Without a public-suffix list this is
#: an approximation, and only decides which routing record is offered.
_SECOND_LEVEL = frozenset({"co", "com", "org", "net", "ac", "gov", "edu", "ltd", "plc", "or", "ne"})


def registered_domain(domain: str) -> str:
    """The part bought from a registrar: ``example.com`` of ``www.example.com``."""
    labels = domain.split(".")
    keep = 3 if len(labels) >= 3 and len(labels[-1]) == 2 and labels[-2] in _SECOND_LEVEL else 2
    return ".".join(labels[-keep:])


def is_apex(domain: str) -> bool:
    return registered_domain(domain) == domain


def _relative(name: str, apex: str) -> str:
    """``www.example.com`` → ``www``; ``example.com`` → ``@``."""
    return "@" if name == apex else name.removesuffix(f".{apex}")


def verification_token(user_id: uuid.UUID, domain: str) -> str:
    secret = get_settings().jwt_secret.encode()
    message = f"custom-domain:{user_id}:{domain}".encode()
    return hmac.new(secret, message, hashlib.sha256).hexdigest()[:32]


def cname_target() -> str:
    settings = get_settings()
    target = settings.domain_cname_target or settings.root_domain
    # A root with a port (localhost:3000) is development: there is no DNS name.
    return "" if ":" in target else target


def is_ours(domain: str) -> bool:
    """The root domain and anything under it are served as subdomains."""
    root = get_settings().root_domain.split(":", 1)[0]
    return bool(root) and (domain == root or domain.endswith(f".{root}"))


def records(user_id: uuid.UUID, domain: str) -> list[DnsRecordOut] | None:
    """What to add at the DNS provider, or None when this server has no
    address for a domain to point at."""
    target = cname_target()
    if not target:
        return None
    apex = registered_domain(domain)
    verify_name = f"{VERIFY_LABEL}.{domain}"
    out = [
        DnsRecordOut(
            type="TXT",
            host=_relative(verify_name, apex),
            name=verify_name,
            value=f"{TOKEN_PREFIX}{verification_token(user_id, domain)}",
            purpose="verify",
        )
    ]
    if not is_apex(domain):
        out.append(
            DnsRecordOut(
                type="CNAME",
                host=_relative(domain, apex),
                name=domain,
                value=target,
                purpose="route",
            )
        )
    elif ips := get_settings().domain_apex_ips:
        out.extend(
            DnsRecordOut(type="A", host="@", name=domain, value=ip, purpose="route") for ip in ips
        )
    else:
        out.append(DnsRecordOut(type="ALIAS", host="@", name=domain, value=target, purpose="route"))
    return out


async def check(lookup: DnsLookup, user_id: uuid.UUID, domain: str) -> tuple[bool, bool]:
    """(owned, routed): whether the TXT record and the routing record are live."""
    expected = f"{TOKEN_PREFIX}{verification_token(user_id, domain)}"
    owned = expected in [value.strip() for value in await lookup.txt(f"{VERIFY_LABEL}.{domain}")]

    target = cname_target()
    routed = False
    if target:
        if target in await lookup.cname(domain):
            routed = True
        else:
            # An A record to the host's address, or an ALIAS/ANAME, which a
            # provider flattens into the target's own addresses.
            addresses = set(await lookup.a(domain))
            wanted = set(get_settings().domain_apex_ips) | set(await lookup.a(target))
            routed = bool(addresses & wanted)
    return owned, routed
