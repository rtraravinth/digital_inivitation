"""DNS lookups, for proving a custom domain belongs to the account.

A domain is verified by a TXT record only its owner could have added, and
the check is a real lookup through the system's resolvers. Tests override
``get_dns_lookup`` with a fake that answers from a dict.
"""

from __future__ import annotations

from typing import Annotated, Protocol

import dns.asyncresolver
import dns.exception
import dns.resolver
from fastapi import Depends

#: Seconds before a lookup gives up. A slow nameserver reads as "not found
#: yet", which is what the person is told; they can check again.
LOOKUP_SECONDS = 5.0

#: Every way a name can fail to answer that means "the record is not there".
_ABSENT = (
    dns.resolver.NXDOMAIN,
    dns.resolver.NoAnswer,
    dns.resolver.NoNameservers,
    dns.exception.Timeout,
)


class DnsLookup(Protocol):
    async def txt(self, name: str) -> list[str]: ...
    async def cname(self, name: str) -> list[str]: ...
    async def a(self, name: str) -> list[str]: ...


class ResolverLookup:
    def __init__(self) -> None:
        self._resolver = dns.asyncresolver.Resolver()
        self._resolver.lifetime = LOOKUP_SECONDS

    async def _query(self, name: str, rdtype: str) -> list:
        try:
            return list(await self._resolver.resolve(name, rdtype))
        except _ABSENT:
            return []

    async def txt(self, name: str) -> list[str]:
        return [
            b"".join(record.strings).decode("utf-8", "replace")
            for record in await self._query(name, "TXT")
        ]

    async def cname(self, name: str) -> list[str]:
        return [
            record.target.to_text().rstrip(".").lower()
            for record in await self._query(name, "CNAME")
        ]

    async def a(self, name: str) -> list[str]:
        return [record.address for record in await self._query(name, "A")]


async def get_dns_lookup() -> DnsLookup:
    """The lookup a route uses. Tests override this dependency."""
    return ResolverLookup()


DnsLookupDep = Annotated[DnsLookup, Depends(get_dns_lookup)]
