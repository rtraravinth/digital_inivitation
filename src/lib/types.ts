export type LinkItem = {
  id: string;
  label: string;
  url: string;
};

/** Optional extras — they feed the published page's stat and timeline panels. */
export type Stat = { id: string; label: string; value: string };
export type DateEntry = { id: string; year: string; text: string };

/**
 * An upload, kept as a data URI so it survives in localStorage with no
 * backend. Images are downscaled on the way in; see lib/assets.ts.
 */
export type Asset = { name: string; mime: string; dataUrl: string; size: number };

export type Quote = { text: string; attribution: string };

/**
 * Every section is the same four fields — title, description, tags, links —
 * so there is nothing to learn twice. Everything below that is opt-in.
 */
export type Section = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  links: LinkItem[];
  numbers: Stat[];
  dates: DateEntry[];
  image: Asset | null;
  file: Asset | null;
  quote: Quote | null;
};

/** The header is a section with two extra lines: who you are, and what you're doing now. */
export type PortfolioHeader = {
  name: string;
  current: string;
  description: string;
  tags: string[];
  links: LinkItem[];
  portrait: Asset | null;
};

export type PortfolioStatus = "live" | "draft" | "empty";

/** The three published-page structures. Content stays put; the frame changes. */
export type ThemeId = "editorial" | "index" | "poster";
export type Ground = "light" | "dark" | "paper";
export type FontId = "archivo" | "fraunces" | "space-grotesk";

export const THEMES: Array<{ id: ThemeId; name: string; desc: string }> = [
  { id: "editorial", name: "Editorial", desc: "Tabs across a modular grid" },
  { id: "index", name: "Index rail", desc: "Roles as a numbered sidebar, content as records" },
  { id: "poster", name: "Poster", desc: "Accent field hero, roles as a statement" },
];

export const GROUNDS: Array<{ id: Ground; name: string }> = [
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
  { id: "paper", name: "Paper" },
];

/**
 * Headline faces over an Archivo body. Archivo/Archivo is the Modernist
 * default and stays the default — the alternates are opt-in per portfolio.
 */
export const FONTS: Array<{ id: FontId; name: string; sample: string; cssVar: string }> = [
  { id: "archivo", name: "Archivo", sample: "One family throughout", cssVar: "--font-archivo" },
  { id: "fraunces", name: "Fraunces", sample: "Serif headline", cssVar: "--font-fraunces" },
  {
    id: "space-grotesk",
    name: "Space Grotesk",
    sample: "Geometric headline",
    cssVar: "--font-space-grotesk",
  },
];

/** One accent runs the page — buttons, kickers and the closing banner. */
export const SWATCHES = ["#ec3013", "#201e1d", "#1d4ed8", "#0f7b52", "#b45309"];

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
  font: FontId;
  header: PortfolioHeader;
  sections: Section[];
};

/** Fills in fields added after a portfolio was first stored. */
export function normalize(p: Portfolio): Portfolio {
  return {
    ...p,
    theme: p.theme ?? "editorial",
    accent: p.accent ?? SWATCHES[0],
    ground: p.ground ?? "light",
    font: p.font ?? "archivo",
    header: { ...emptyHeader(), ...(p.header ?? {}) },
    sections: (p.sections ?? []).map((s) => ({
      ...emptySection(s.id),
      ...s,
      links: s.links ?? [],
      tags: s.tags ?? [],
      numbers: s.numbers ?? [],
      dates: s.dates ?? [],
    })),
  };
}

export const STATUS_LABEL: Record<PortfolioStatus, string> = {
  live: "Live",
  draft: "Draft",
  empty: "Empty",
};

export function emptyHeader(): PortfolioHeader {
  return { name: "", current: "", description: "", tags: [], links: [], portrait: null };
}

export function emptySection(id: string): Section {
  return {
    id,
    title: "",
    description: "",
    tags: [],
    links: [],
    numbers: [],
    dates: [],
    image: null,
    file: null,
    quote: null,
  };
}
