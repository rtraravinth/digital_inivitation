export type LinkItem = {
  id: string;
  label: string;
  url: string;
};

/** Optional extras — they feed the published page's stat and timeline panels. */
export type Stat = { id: string; label: string; value: string };
export type DateEntry = { id: string; year: string; text: string };

/**
 * An upload. `url` points at the API, which stores the bytes and does the
 * downscaling — see lib/assets.ts.
 *
 * `dataUrl` is the pre-backend form and is kept optional so portfolios stored
 * before the API existed still render. Read an asset with `assetSrc()`, never
 * either field directly.
 */
export type Asset = {
  id?: string;
  url?: string;
  name: string;
  mime: string;
  size: number;
  dataUrl?: string;
};

/** Where to load an asset from, whichever era it came from. */
export function assetSrc(asset: Asset | null | undefined): string | undefined {
  if (!asset) return undefined;
  if (asset.url) {
    return asset.url.startsWith("http")
      ? asset.url
      : `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000"}${asset.url}`;
  }
  return asset.dataUrl;
}

export type Quote = { text: string; attribution: string };

/**
 * What a section files under when the page has no tabs yet. Mirrors
 * DEFAULT_TAB in backend/app/models/enums.py.
 */
export const DEFAULT_TAB = "Work";

/** As long as a tab name may be. Mirrors TAB_MAX_LENGTH on the API. */
export const TAB_MAX_LENGTH = 60;

/**
 * Every section is the same four fields — title, description, tab, links —
 * so there is nothing to learn twice. Everything below that is opt-in.
 *
 * `tab` is the exception: a visitor reaches a section through its tab and
 * nowhere else, so it is required and never blank. One tab per section, and
 * the page's tab row is the distinct set of them.
 *
 * Numbers and the timeline are not here: the page draws one of each, from
 * the header. See `PortfolioHeader`.
 */
export type Section = {
  id: string;
  title: string;
  description: string;
  tab: string;
  links: LinkItem[];
  image: Asset | null;
  file: Asset | null;
  quote: Quote | null;
  /** Hidden sections stay in the document and off the published page. */
  hidden: boolean;
};

/**
 * The header is a section with two extra lines: who you are, and what you're
 * doing now — plus the two lists the whole page shares. `numbers` fills the
 * "By the numbers" row and `dates` the timeline; both are drawn once, so
 * they belong to the portfolio rather than to whichever section they were
 * typed into.
 */
export type PortfolioHeader = {
  name: string;
  current: string;
  description: string;
  tags: string[];
  links: LinkItem[];
  numbers: Stat[];
  dates: DateEntry[];
  portrait: Asset | null;
};

export type PortfolioStatus = "live" | "draft" | "empty";

/** The published-page structures. Content stays put; the frame changes. */
export type ThemeId =
  | "editorial"
  | "index"
  | "poster"
  | "links"
  | "ledger"
  | "dossier"
  | "broadsheet";

export type Ground = "light" | "dark" | "paper";
export type FontId =
  | "archivo"
  | "inter"
  | "dm-sans"
  | "space-grotesk"
  | "manrope"
  | "fraunces"
  | "playfair-display"
  | "source-serif-4"
  | "lora"
  | "roboto-slab"
  | "bitter"
  | "oswald"
  | "syne"
  | "jetbrains-mono";

/** The gallery filters by who a theme suits, not by what it looks like. */
export type ThemeAudience = "founders" | "advisers" | "office" | "writers" | "multi";

export const THEME_AUDIENCES: Array<{ id: ThemeAudience; name: string }> = [
  { id: "founders", name: "Founders" },
  { id: "advisers", name: "Advisers" },
  { id: "office", name: "Public office" },
  { id: "writers", name: "Writers" },
  { id: "multi", name: "Multi-role" },
];

export const THEMES: Array<{
  id: ThemeId;
  name: string;
  desc: string;
  long: string;
  badge?: string;
  audiences: ThemeAudience[];
}> = [
  {
    id: "editorial",
    name: "Editorial",
    desc: "Tabs across a modular grid",
    long: "A tabbed grid with the portrait on the right. The default, and the safest.",
    audiences: ["founders", "multi", "advisers"],
  },
  {
    id: "index",
    name: "Index rail",
    desc: "Tabs as a numbered sidebar, content as records",
    long: "A numbered rail of tabs beside records of the work. Good for long histories.",
    audiences: ["advisers", "office", "multi"],
  },
  {
    id: "poster",
    name: "Poster",
    desc: "Accent field hero, tabs as a statement",
    long: "A colour field and display type. Loud, for people who present a lot.",
    audiences: ["founders", "writers"],
  },
  {
    id: "links",
    name: "Links",
    desc: "Tabs over a stack of tappable rows",
    long: "One shareable page of rows, sized for a thumb. The link you put in a bio.",
    audiences: ["founders", "writers", "multi"],
  },
  {
    id: "ledger",
    name: "Ledger",
    desc: "Everything as one long table",
    long: "Everything as one long table. Built for people with a lot of entries.",
    audiences: ["advisers", "office"],
  },
  {
    id: "dossier",
    name: "Dossier",
    desc: "Visitor picks a lens, the page rewrites itself",
    long: "The visitor picks a lens first — one of your tabs — and the page rewrites itself around it.",
    badge: "New",
    audiences: ["multi", "advisers", "office"],
  },
  {
    id: "broadsheet",
    name: "Broadsheet",
    desc: "Columns of type with rules between",
    long: "Three columns of type with rules between. Reads like a newspaper page.",
    audiences: ["writers", "office"],
  },
];

/**
 * `hex` is the paper each preset paints, duplicated from the palette map in
 * `published/themes.tsx` so the picker can show a preset as a swatch and can
 * hand the custom field somewhere to start from. The map there stays the
 * authority on the other five variables a preset sets.
 */
export const GROUNDS: Array<{ id: Ground; name: string; hex: string }> = [
  { id: "light", name: "Light", hex: "#f3f2f2" },
  { id: "dark", name: "Dark", hex: "#201e1d" },
  { id: "paper", name: "Paper", hex: "#efe9dd" },
];

/**
 * Headline faces over an Archivo body. Archivo/Archivo is the Modernist
 * default and stays the default — the alternates are opt-in per portfolio,
 * and the body never changes.
 *
 * Every face here is variable and reaches at least 700. That is the entry
 * requirement, not a coincidence: `globals.css` sets `font-weight: 800` on
 * every heading, so a single-weight family would be faux-bolded by the
 * browser and come out smeared. It is why the obvious display picks —
 * Anton, Bebas Neue, Instrument Serif — are absent.
 *
 * Ordered by kind rather than alphabetically, so scanning the list moves
 * through sans, serif, slab, condensed, display, mono.
 */
export const FONTS: Array<{ id: FontId; name: string; sample: string; cssVar: string }> = [
  { id: "archivo", name: "Archivo", sample: "One family throughout", cssVar: "--font-archivo" },
  { id: "inter", name: "Inter", sample: "Neutral sans", cssVar: "--font-inter" },
  { id: "dm-sans", name: "DM Sans", sample: "Geometric sans", cssVar: "--font-dm-sans" },
  {
    id: "space-grotesk",
    name: "Space Grotesk",
    sample: "Sans with a quirk",
    cssVar: "--font-space-grotesk",
  },
  { id: "manrope", name: "Manrope", sample: "Humanist sans", cssVar: "--font-manrope" },
  { id: "fraunces", name: "Fraunces", sample: "Soft serif", cssVar: "--font-fraunces" },
  {
    id: "playfair-display",
    name: "Playfair Display",
    sample: "High-contrast serif",
    cssVar: "--font-playfair-display",
  },
  {
    id: "source-serif-4",
    name: "Source Serif 4",
    sample: "Transitional serif",
    cssVar: "--font-source-serif-4",
  },
  { id: "lora", name: "Lora", sample: "Bookish serif", cssVar: "--font-lora" },
  { id: "roboto-slab", name: "Roboto Slab", sample: "Slab serif", cssVar: "--font-roboto-slab" },
  { id: "bitter", name: "Bitter", sample: "Contemporary slab", cssVar: "--font-bitter" },
  { id: "oswald", name: "Oswald", sample: "Condensed headline", cssVar: "--font-oswald" },
  { id: "syne", name: "Syne", sample: "Display, wide", cssVar: "--font-syne" },
  {
    id: "jetbrains-mono",
    name: "JetBrains Mono",
    sample: "Monospace headline",
    cssVar: "--font-jetbrains-mono",
  },
];

/** One accent runs the page — buttons, kickers and the closing banner. */
export const SWATCHES = ["#ec3013", "#201e1d", "#1d4ed8", "#0f7b52", "#b45309"];

/**
 * Both pickers write straight into a style attribute on the published page,
 * so a value that is not exactly `#rrggbb` is never stored. This is also
 * what lets a hex field hold a half-typed value without saving it.
 */
export function isHexColour(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/**
 * What a hex field should commit as the user types. Accepts a missing `#`
 * and any case, and returns null while the value is still incomplete.
 */
export function readHexColour(value: string): string | null {
  const trimmed = value.trim();
  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return isHexColour(hex) ? hex.toLowerCase() : null;
}

/* ── layout ───────────────────────────────────────────────────────────── */

/**
 * How a visitor moves between the tabs. The key stays `roleNav`: it is the
 * wire format and a stored value, and renaming it would buy nothing a label
 * change does not.
 */
export type RoleNav = "tabs" | "rail" | "scroll" | "lens";
export type GridCols = 1 | 2 | 3;
export type Density = "airy" | "standard" | "dense";

export const ROLE_NAVS: Array<{ id: RoleNav; name: string }> = [
  { id: "tabs", name: "Tabs across the page" },
  { id: "rail", name: "Numbered side rail" },
  { id: "scroll", name: "One scroll, tabs as chapters" },
  { id: "lens", name: "Visitor picks a lens first" },
];

export const DENSITIES: Array<{ id: Density; name: string }> = [
  { id: "airy", name: "Airy" },
  { id: "standard", name: "Standard" },
  { id: "dense", name: "Dense — more per screen" },
];

/** The headline scale multiplies each theme's own display size. */
export type TypeScale = "compact" | "default" | "display";

export const TYPE_SCALES: Array<{ id: TypeScale; name: string; factor: number }> = [
  { id: "compact", name: "Compact", factor: 0.82 },
  { id: "default", name: "Default", factor: 1 },
  { id: "display", name: "Display", factor: 1.28 },
];

export const DEFAULT_TRACKING = "-0.015em";

export type Layout = {
  roleNav: RoleNav;
  grid: GridCols;
  density: Density;
  scale: TypeScale;
  /** Any CSS letter-spacing value; the published page reads it as a token. */
  tracking: string;
};

export function defaultLayout(): Layout {
  return {
    roleNav: "tabs",
    grid: 2,
    density: "standard",
    scale: "default",
    tracking: DEFAULT_TRACKING,
  };
}

export type Portfolio = {
  id: string;
  name: string;
  /** The page address, without the facet.page/ prefix. */
  slug: string;
  status: PortfolioStatus;
  summary: string;
  meta: string;
  theme: ThemeId;
  accent: string;
  ground: Ground;
  /**
   * A picked ground colour, which wins over the `ground` preset. Empty means
   * "use the preset" — the preset always stays set, so clearing a custom
   * colour has somewhere to fall back to.
   */
  groundHex: string;
  /** The headline face. Kept as `font` because it is the wire format and a
   *  stored value; the body face is `bodyFont`. */
  font: FontId;
  bodyFont: FontId;
  layout: Layout;
  header: PortfolioHeader;
  sections: Section[];
};

const THEME_IDS = new Set<string>(THEMES.map((t) => t.id));

/** Fills in fields added after a portfolio was first stored. */
export function normalize(p: Portfolio): Portfolio {
  const layout = { ...defaultLayout(), ...(p.layout ?? {}) };
  return {
    ...p,
    // An unknown theme means data from a build that had one we've since
    // dropped; fall back rather than render nothing.
    theme: THEME_IDS.has(p.theme) ? p.theme : "editorial",
    accent: p.accent ?? SWATCHES[0],
    ground: p.ground ?? "light",
    groundHex: isHexColour(p.groundHex) ? p.groundHex : "",
    font: p.font ?? "archivo",
    bodyFont: p.bodyFont ?? "archivo",
    layout: {
      roleNav: layout.roleNav ?? "tabs",
      grid: layout.grid ?? 2,
      density: layout.density ?? "standard",
      scale: layout.scale ?? "default",
      tracking: layout.tracking ?? DEFAULT_TRACKING,
    },
    header: {
      ...emptyHeader(),
      ...(p.header ?? {}),
      numbers: p.header?.numbers ?? [],
      dates: p.header?.dates ?? [],
    },
    sections: (p.sections ?? []).map((s) => ({
      ...emptySection(s.id),
      ...s,
      links: s.links ?? [],
      // A section written before tabs existed carries none. It would be
      // unreachable with a blank one, so it lands on the default.
      tab: s.tab?.trim() || DEFAULT_TAB,
      hidden: s.hidden ?? false,
    })),
  };
}

export const STATUS_LABEL: Record<PortfolioStatus, string> = {
  live: "Published",
  draft: "Not published",
  // Still its own word: an empty portfolio is not published either, but it
  // has nothing on it yet, which is what the card is telling you.
  empty: "Empty",
};

export function emptyHeader(): PortfolioHeader {
  return {
    name: "",
    current: "",
    description: "",
    tags: [],
    links: [],
    numbers: [],
    dates: [],
    portrait: null,
  };
}

export function emptySection(id: string): Section {
  return {
    id,
    title: "",
    description: "",
    tab: DEFAULT_TAB,
    links: [],
    image: null,
    file: null,
    quote: null,
    hidden: false,
  };
}

/* ── account ──────────────────────────────────────────────────────────── */

/**
 * Everything on /account that isn't a portfolio. Most of it describes a
 * server this build doesn't have — see NEEDS_SERVER below and the notice the
 * Account page renders. It is stored, and honest about what it can't do.
 */
/** Mirrors PASSWORD_MIN in backend/app/schemas/auth.py. The server is what
 * enforces it; this is so the UI can say so before the round trip. */
export const PASSWORD_MIN = 12;

/** The public domain these pages are published under. */
export const PAGE_DOMAIN = "facet.page";

/**
 * A page's address, which is `<handle>/<slug>` — the handle is the namespace,
 * so a slug alone no longer identifies a page. One place for it, because it
 * is printed on the dashboard, the builder, the block manager, /stats, and
 * inside a QR code that has to match all of them.
 */
export function pageAddress(handle: string, slug: string): string {
  return `${PAGE_DOMAIN}/${handle}/${slug}`;
}

/** The same page on this app: the route that actually serves it. */
export function pagePath(handle: string, slug: string): string {
  return `/p/${handle}/${slug}`;
}

/**
 * The owner's own preview of a portfolio, published or not.
 *
 * `pagePath` is the visitor's address and only resolves while the portfolio
 * is live; every Preview button inside the app uses this instead, so a draft
 * previews rather than 404s.
 */
export function previewPath(id: string): string {
  return `/preview/${id}`;
}

export type AccountProfile = {
  name: string;
  handle: string;
  current: string;
  about: string;
  tags: string[];
  links: LinkItem[];
  portrait: Asset | null;
};

/**
 * What /account can safely know about your security settings. The TOTP seed
 * and the recovery-code hashes never leave the server, so this carries a
 * count rather than the codes themselves.
 */
export type AccountSecurity = {
  email: string;
  phone: string;
  /** ISO timestamp, or null if it has never been changed. */
  passwordChanged: string | null;
  twoStep: boolean;
  google: boolean;
  recoveryCodesRemaining: number;
};

export type PlanId = "free" | "pro";

export const PLANS: Array<{
  id: PlanId;
  name: string;
  price: string;
  features: string[];
}> = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    features: [
      "One portfolio, unlimited sections",
      "facet.page address",
      "Basic view counts",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹499 / mo",
    features: [
      "Unlimited portfolios",
      "Your own domain",
      "Click and referrer stats",
      "PDF export of any page",
      "No Facet badge",
    ],
  },
];

export type NotificationKey =
  | "booking"
  | "weekly"
  | "brokenLink"
  | "mention"
  | "product";

export const NOTIFICATIONS: Array<{
  id: NotificationKey;
  title: string;
  desc: string;
}> = [
  {
    id: "booking",
    title: "Someone books an intro call",
    desc: "Email and push, straight away.",
  },
  {
    id: "weekly",
    title: "Weekly summary",
    desc: "Views, clicks and where they came from.",
  },
  {
    id: "brokenLink",
    title: "A link on your page breaks",
    desc: "We check your links once a week.",
  },
  {
    id: "mention",
    title: "Someone mentions your page",
    desc: "When a site we can see links to you.",
  },
  {
    id: "product",
    title: "Product news from Facet",
    desc: "New themes and section types. Roughly monthly.",
  },
];

export type PrivacyKey = "indexable" | "showContact" | "countVisits" | "badge";

export const PRIVACY_SETTINGS: Array<{
  id: PrivacyKey;
  title: string;
  desc: string;
  /** True when flipping this actually changes the app's behaviour. */
  wired: boolean;
}> = [
  {
    id: "indexable",
    title: "Let search engines index my pages",
    desc: "Turn off and your pages only open for people you send the link to.",
    wired: true,
  },
  {
    id: "showContact",
    title: "Show contact details to signed-out visitors",
    desc: "Off hides the header's links behind a note on the published page.",
    wired: true,
  },
  {
    id: "countVisits",
    title: "Count visits",
    desc: "Aggregate only, in this browser. No cookies, no third-party trackers.",
    wired: true,
  },
  {
    id: "badge",
    title: "Show a “Made with Facet” badge",
    desc: "The claim bar at the top of every published page.",
    wired: true,
  },
];

export type AccountSettings = {
  profile: AccountProfile;
  security: AccountSecurity;
  plan: PlanId;
  customDomain: string;
  notifications: Record<NotificationKey, boolean>;
  privacy: Record<PrivacyKey, boolean>;
};

export function defaultAccount(): AccountSettings {
  // Empty, not a persona. This is what /account renders for the moment
  // before the real account arrives, and inventing a name to fill that gap
  // would be showing the user data that is not theirs.
  return {
    profile: {
      name: "",
      handle: "",
      current: "",
      about: "",
      tags: [],
      links: [],
      portrait: null,
    },
    security: {
      email: "",
      phone: "",
      passwordChanged: null,
      twoStep: false,
      google: false,
      recoveryCodesRemaining: 0,
    },
    plan: "free",
    customDomain: "",
    notifications: {
      booking: true,
      weekly: true,
      brokenLink: true,
      mention: false,
      product: false,
    },
    privacy: {
      indexable: true,
      showContact: true,
      countVisits: true,
      badge: true,
    },
  };
}

/**
 * The three /account groups that still need a third-party service this build
 * has not chosen. Their settings are stored and enforce nothing, and each
 * group renders a <ServerNotice> saying so in as many words.
 *
 * Sign-in, passwords, two-step, recovery codes and the device list used to be
 * on this list. They are real now, so they are not.
 */
export const NEEDS_SERVER = {
  billing: "Taking a payment needs a payment processor.",
  domain: "Serving your own domain needs DNS and a host.",
  email: "Sending mail needs a mail service.",
} as const;
