"""The allowed values for every constrained column.

These mirror the TypeScript literal unions in ``src/lib/types.ts``. They are
duplicated rather than generated because the frontend is the source of truth
for what the product offers, and a silent drift here would let the API accept
a theme the UI cannot render. The check constraints make drift loud.
"""

from __future__ import annotations

from typing import Final, Literal

ThemeId = Literal["aurora", "meridian", "stage", "arcade", "journey", "bio"]
THEMES: Final[tuple[str, ...]] = ("aurora", "meridian", "stage", "arcade", "journey", "bio")

#: The theme a new portfolio opens on, and the fallback for an unknown one.
DEFAULT_THEME: Final[str] = "aurora"

#: Themes this build no longer offers, and the one that took each one's place.
#: Read wherever stored data from an older build can arrive — an import file,
#: in particular — so a portfolio keeps the nearest look rather than the
#: default. The migration that retired them applies the same map to the table.
LEGACY_THEMES: Final[dict[str, str]] = {
    "editorial": "aurora",
    "site": "aurora",
    "resume": "meridian",
    "poster": "stage",
    "links": "journey",
}

Ground = Literal["light", "dark", "paper"]
GROUNDS: Final[tuple[str, ...]] = ("light", "dark", "paper")

FontId = Literal[
    "bodoni-moda",
    "schibsted-grotesk",
    "archivo",
    "inter",
    "dm-sans",
    "space-grotesk",
    "manrope",
    "fraunces",
    "playfair-display",
    "source-serif-4",
    "lora",
    "roboto-slab",
    "bitter",
    "oswald",
    "syne",
    "jetbrains-mono",
    "lexend",
    "outfit",
]
FONTS: Final[tuple[str, ...]] = (
    "bodoni-moda",
    "schibsted-grotesk",
    "archivo",
    "inter",
    "dm-sans",
    "space-grotesk",
    "manrope",
    "fraunces",
    "playfair-display",
    "source-serif-4",
    "lora",
    "roboto-slab",
    "bitter",
    "oswald",
    "syne",
    "jetbrains-mono",
    "lexend",
    "outfit",
)

PortfolioStatus = Literal["live", "draft", "empty"]
STATUSES: Final[tuple[str, ...]] = ("live", "draft", "empty")

RoleNav = Literal["tabs", "rail", "scroll", "lens"]
ROLE_NAVS: Final[tuple[str, ...]] = ("tabs", "rail", "scroll", "lens")

Density = Literal["airy", "standard", "dense"]
DENSITIES: Final[tuple[str, ...]] = ("airy", "standard", "dense")

TypeScale = Literal["compact", "default", "display"]
TYPE_SCALES: Final[tuple[str, ...]] = ("compact", "default", "display")

#: How photographs print on the published page. Mirrors ``PhotoTreatment`` in
#: src/lib/types.ts; "colour" is the default for a layout that never set one.
PhotoTreatment = Literal["colour", "bw"]

#: How much the published page moves. Mirrors ``MotionLevel`` in
#: src/lib/types.ts; "full" is the default for a layout that never set one.
#: A visitor's own reduced-motion preference still wins over "full".
MotionLevel = Literal["full", "subtle", "off"]

#: How the page's plain sections — the ones a theme would draw as cards — are
#: laid out. "theme" leaves it to the theme. One choice for the whole page: a
#: section files under nothing but its own title, so there is no tab to hang
#: a per-group choice on. Mirrors SECTION_STYLES in src/lib/types.ts.
SectionStyle = Literal[
    "theme", "grid", "timeline", "carousel", "tabs", "list", "spotlight", "chips"
]

PlanId = Literal["free", "pro"]
PLANS: Final[tuple[str, ...]] = ("free", "pro")

AssetKind = Literal["image", "file"]
ASSET_KINDS: Final[tuple[str, ...]] = ("image", "file")

NotificationKey = Literal["booking", "weekly", "brokenLink", "mention", "product"]
NOTIFICATION_KEYS: Final[tuple[str, ...]] = (
    "booking",
    "weekly",
    "brokenLink",
    "mention",
    "product",
)

PrivacyKey = Literal["indexable", "showContact", "countVisits", "badge"]
PRIVACY_KEYS: Final[tuple[str, ...]] = ("indexable", "showContact", "countVisits", "badge")

#: The one accent that ships as the default, from SWATCHES[0] — book cloth.
DEFAULT_ACCENT: Final[str] = "#b5261e"

#: The house type pairing: the catalogue's didone over its caption grotesk.
#: Mirrors the first two entries of FONTS in src/lib/types.ts.
DEFAULT_FONT: Final[str] = "bodoni-moda"
DEFAULT_BODY_FONT: Final[str] = "schibsted-grotesk"

#: The stock a new portfolio prints on. "dark" is board; the key is the wire
#: format and did not change when the colour it names did.
DEFAULT_GROUND: Final[str] = "dark"
DEFAULT_TRACKING: Final[str] = "-0.015em"

#: What a section files under when the page has no tabs yet. Every section
#: needs one — it is the only route a visitor has to the section.
DEFAULT_TAB: Final[str] = "Work"
TAB_MAX_LENGTH: Final[int] = 60


def sql_in(values: tuple[str, ...]) -> str:
    """Render a tuple as a SQL IN list for a CheckConstraint."""
    return ", ".join(f"'{value}'" for value in values)


#: The components a section can carry under its own four fields. Each one is a
#: shape a visitor recognises from public portfolio pages — a timeline, a wall
#: of client names, quotes from people the author worked with. Mirrors
#: BLOCK_TYPES in src/lib/types.ts.
BlockType = Literal[
    "timeline",
    "testimonials",
    "clients",
    "tabs",
    "stats",
    "services",
    "faq",
    "contact",
]
BLOCK_TYPES: Final[tuple[str, ...]] = (
    "timeline",
    "testimonials",
    "clients",
    "tabs",
    "stats",
    "services",
    "faq",
    "contact",
)

#: How many images one section may carry, and how many components. Generous
#: for a portfolio entry; there to stop a runaway client, not to ration anyone.
SECTION_IMAGES_MAX: Final[int] = 12
SECTION_BLOCKS_MAX: Final[int] = 12
BLOCK_ITEMS_MAX: Final[int] = 40
