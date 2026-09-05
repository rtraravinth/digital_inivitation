"""The allowed values for every constrained column.

These mirror the TypeScript literal unions in ``src/lib/types.ts``. They are
duplicated rather than generated because the frontend is the source of truth
for what the product offers, and a silent drift here would let the API accept
a theme the UI cannot render. The check constraints make drift loud.
"""

from __future__ import annotations

from typing import Final, Literal

ThemeId = Literal[
    "editorial", "index", "poster", "links", "ledger", "dossier", "broadsheet"
]
THEMES: Final[tuple[str, ...]] = (
    "editorial", "index", "poster", "links", "ledger", "dossier", "broadsheet",
)

Ground = Literal["light", "dark", "paper"]
GROUNDS: Final[tuple[str, ...]] = ("light", "dark", "paper")

FontId = Literal["archivo", "fraunces", "space-grotesk"]
FONTS: Final[tuple[str, ...]] = ("archivo", "fraunces", "space-grotesk")

PortfolioStatus = Literal["live", "draft", "empty"]
STATUSES: Final[tuple[str, ...]] = ("live", "draft", "empty")

BlockKind = Literal[
    "link", "venture", "contact", "booking", "testimonial", "gallery", "numbers", "document"
]
BLOCK_KINDS: Final[tuple[str, ...]] = (
    "link", "venture", "contact", "booking", "testimonial", "gallery", "numbers", "document",
)

RoleNav = Literal["tabs", "rail", "scroll", "lens"]
ROLE_NAVS: Final[tuple[str, ...]] = ("tabs", "rail", "scroll", "lens")

Density = Literal["airy", "standard", "dense"]
DENSITIES: Final[tuple[str, ...]] = ("airy", "standard", "dense")

TypeScale = Literal["compact", "default", "display"]
TYPE_SCALES: Final[tuple[str, ...]] = ("compact", "default", "display")

PlanId = Literal["free", "pro"]
PLANS: Final[tuple[str, ...]] = ("free", "pro")

AssetKind = Literal["image", "file"]
ASSET_KINDS: Final[tuple[str, ...]] = ("image", "file")

NotificationKey = Literal["booking", "weekly", "brokenLink", "mention", "product"]
NOTIFICATION_KEYS: Final[tuple[str, ...]] = (
    "booking", "weekly", "brokenLink", "mention", "product",
)

PrivacyKey = Literal["indexable", "showContact", "countVisits", "badge"]
PRIVACY_KEYS: Final[tuple[str, ...]] = ("indexable", "showContact", "countVisits", "badge")

#: The one accent that ships as the default, from SWATCHES[0].
DEFAULT_ACCENT: Final[str] = "#ec3013"
DEFAULT_TRACKING: Final[str] = "-0.015em"


def sql_in(values: tuple[str, ...]) -> str:
    """Render a tuple as a SQL IN list for a CheckConstraint."""
    return ", ".join(f"'{value}'" for value in values)
