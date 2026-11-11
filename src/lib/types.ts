export type LinkItem = {
  id: string;
  label: string;
  url: string;
  /** Overrides the icon `iconFor()` would derive from `url`. Absent means
   *  "decide from the address" — which is what almost every link wants, so
   *  the field is optional and `normalize()` leaves it alone. */
  icon?: string;
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

/* ── components ───────────────────────────────────────────────────────────
   A section is a heading — section title, title, description, links, one
   cover picture — and everything under that is a component: the shapes a
   visitor recognises from public portfolio pages. Mirrors
   app/schemas/blocks.py. None of them holds an upload: a testimonial shows
   initials, a client is a wordmark, and a gallery only *names* pictures the
   section already holds (`imageIds` into `section.images`), so every upload
   reference stays a section picture, a file or the portrait.
   ──────────────────────────────────────────────────────────────────────── */

export type TimelineItem = { id: string; date: string; title: string; text: string };
export type TestimonialItem = { id: string; quote: string; name: string; role: string };
export type ClientItem = { id: string; name: string; url: string };
export type TabItem = { id: string; label: string; text: string };
export type StatItem = { id: string; value: string; label: string };
export type ServiceItem = { id: string; title: string; text: string; price: string };
export type FaqItem = { id: string; question: string; answer: string };

type BlockBase = { id: string; title: string };
export type TimelineBlock = BlockBase & { type: "timeline"; items: TimelineItem[] };
export type TestimonialsBlock = BlockBase & { type: "testimonials"; items: TestimonialItem[] };
export type ClientsBlock = BlockBase & { type: "clients"; items: ClientItem[] };
export type TabsBlock = BlockBase & { type: "tabs"; items: TabItem[] };
export type StatsBlock = BlockBase & { type: "stats"; items: StatItem[] };
export type ServicesBlock = BlockBase & { type: "services"; items: ServiceItem[] };
export type FaqBlock = BlockBase & { type: "faq"; items: FaqItem[] };
/** The visitor's form composes an email in their own mail app — this build
 *  has no mail service, so nothing is sent or stored by the server. */
export type ContactBlock = BlockBase & {
  type: "contact";
  text: string;
  email: string;
  phone: string;
  location: string;
  ctaLabel: string;
  ctaUrl: string;
  form: boolean;
};

/** How a gallery lays its pictures out. */
export type GalleryLayout = "mosaic" | "grid" | "strip";
export const GALLERY_LAYOUTS: Array<{ id: GalleryLayout; name: string; desc: string }> = [
  { id: "mosaic", name: "Mosaic", desc: "The first picture large, the rest in rows under it." },
  { id: "grid", name: "Grid", desc: "Every picture the same size." },
  { id: "strip", name: "Strip", desc: "One row a visitor swipes along." },
];
/**
 * A set of the section's pictures, in the gallery's own order. The bytes
 * stay in `section.images`; this holds their ids. A section's cover is the
 * one picture no gallery names — see `coverOf()`.
 */
export type GalleryBlock = BlockBase & { type: "gallery"; layout: GalleryLayout; imageIds: string[] };

/** How the page draws one of the resume's lists. */
export type ListLook = "list" | "cards" | "timeline" | "tags";
export const LOOK_NAME: Record<ListLook, { name: string; desc: string }> = {
  timeline: { name: "Timeline", desc: "Dates down a rail, most recent first." },
  list: { name: "List", desc: "Ruled rows, one entry each." },
  cards: { name: "Cards", desc: "A grid of cards." },
  tags: { name: "Tags", desc: "Short labels in a row." },
};
/**
 * One of the resume's lists, shown in this section. Like a gallery, it
 * holds nothing itself: the entries are `p.resume[type]`, structured, where
 * the resume templates read them. The component is what puts the list on
 * the page — there is no other switch — so each list is placed at most once
 * in a portfolio.
 */
export type ResumeListBlock = BlockBase & { type: PageBlock; look: ListLook };

export type Block =
  | ResumeListBlock
  | GalleryBlock
  | TimelineBlock
  | TestimonialsBlock
  | ClientsBlock
  | TabsBlock
  | StatsBlock
  | ServicesBlock
  | FaqBlock
  | ContactBlock;
export type BlockType = Block["type"];

/** Every component, in the order the "Add a component" menu offers them. */
export const BLOCK_TYPES: Array<{ id: BlockType; name: string; desc: string }> = [
  { id: "gallery", name: "Gallery", desc: "A set of pictures — as a mosaic, a grid or a strip." },
  { id: "timeline", name: "Timeline", desc: "Milestones in order — a career, a project, a year." },
  { id: "testimonials", name: "Testimonials", desc: "What clients and colleagues say about you." },
  { id: "clients", name: "Clients", desc: "A wall of the names you have worked with." },
  { id: "tabs", name: "Tabs", desc: "A few short panels a visitor switches between." },
  { id: "stats", name: "Numbers", desc: "Two to four figures that make the point." },
  { id: "services", name: "Services", desc: "What you offer, with a price if you like." },
  { id: "faq", name: "Questions", desc: "The questions people ask before they reach out." },
  { id: "contact", name: "Contact", desc: "Email, phone, a booking link and a message form." },
  { id: "experience", name: "Experience", desc: "Your roles, with their dates and what you did." },
  { id: "education", name: "Education", desc: "Degrees, schools and the years." },
  { id: "skills", name: "Skills", desc: "What you are good at, grouped if there are many." },
  { id: "certifications", name: "Certifications", desc: "Qualifications and who issued them." },
  { id: "languages", name: "Languages", desc: "The languages you work in, and how well." },
  { id: "awards", name: "Awards", desc: "Recognition worth a line." },
];

/** Mirrors SECTION_IMAGES_MAX / SECTION_BLOCKS_MAX on the API. */
export const SECTION_IMAGES_MAX = 12;
export const SECTION_BLOCKS_MAX = 12;

/** A fresh component of a type, with one empty item so the form has a row. */
export function emptyBlock(type: BlockType, id: string, itemId: string): Block {
  const base = { id, title: "" };
  switch (type) {
    case "experience":
    case "education":
    case "skills":
    case "certifications":
    case "languages":
    case "awards":
      return { ...base, type, look: LIST_LOOKS[type][0] };
    case "gallery":
      return { ...base, type, layout: "mosaic", imageIds: [] };
    case "timeline":
      return { ...base, type, items: [{ id: itemId, date: "", title: "", text: "" }] };
    case "testimonials":
      return { ...base, type, items: [{ id: itemId, quote: "", name: "", role: "" }] };
    case "clients":
      return { ...base, type, items: [{ id: itemId, name: "", url: "" }] };
    case "tabs":
      return { ...base, type, items: [{ id: itemId, label: "", text: "" }] };
    case "stats":
      return { ...base, type, items: [{ id: itemId, value: "", label: "" }] };
    case "services":
      return { ...base, type, items: [{ id: itemId, title: "", text: "", price: "" }] };
    case "faq":
      return { ...base, type, items: [{ id: itemId, question: "", answer: "" }] };
    case "contact":
      return { ...base, type, text: "", email: "", phone: "", location: "", ctaLabel: "", ctaUrl: "", form: true };
  }
}

/** Whether a component has anything a visitor would see. Empty ones stay in
 *  the editor and off the page, the same as an empty section field. A
 *  resume list's entries are not in the component, so it answers for them
 *  only when handed the resume. */
export function componentHasContent(b: Block, resume?: Resume): boolean {
  if (isListBlock(b)) return resume ? resume[b.type].length > 0 : true;
  if (b.type === "gallery") return b.imageIds.length > 0;
  if (b.type === "contact") return Boolean(b.email || b.phone || b.location || b.ctaUrl || b.text);
  const items = b.items as Array<Record<string, string>>;
  return items.some((item) => Object.entries(item).some(([k, v]) => k !== "id" && typeof v === "string" && v.trim()));
}

/* ── the footer ───────────────────────────────────────────────────────── */

/**
 * The page's closing band. Every field is optional: an empty footer falls
 * back to the header's name and links, so a page whose author never opened
 * the footer card still ends properly. Mirrors `Footer` in
 * app/schemas/portfolio.py.
 */
export type Footer = {
  headline: string;
  text: string;
  ctaLabel: string;
  ctaUrl: string;
  links: LinkItem[];
  note: string;
  showHeaderLinks: boolean;
};

export function emptyFooter(): Footer {
  return { headline: "", text: "", ctaLabel: "", ctaUrl: "", links: [], note: "", showHeaderLinks: true };
}

/**
 * What an untitled section is called on the page's menu.
 */
export const DEFAULT_TAB = "Untitled";

/** As long as a stored tab may be. Mirrors TAB_MAX_LENGTH on the API. */
export const TAB_MAX_LENGTH = 60;

/**
 * A section's place on the page's menu: its own title. A section is one
 * thing with one name — there is no second field to file it under. The API
 * still stores a `tab` per section (required, at most sixty characters), so
 * this is what is sent for it, and what every theme reads instead of the
 * stored value, which lags the title while a save is on its way.
 */
export function tabOf(section: Pick<Section, "title">): string {
  return (section.title ?? "").trim().slice(0, TAB_MAX_LENGTH).trim() || DEFAULT_TAB;
}

/**
 * Every section is the same fields — title, description, links and a cover
 * picture — so there is nothing to learn twice. Components and the rest
 * below that are opt-in.
 *
 * `tab` is the wire format's name for the section's menu label. It is not a
 * field anyone fills in: it is the title, derived by `tabOf()`. It used to
 * be a second name that grouped several sections under one tab; a section
 * now holds components, so what belongs together goes in one section.
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
  /** Every picture the section holds: its cover and its galleries'. Read
   *  them through `coverOf()` and `galleryImages()`, never by index. */
  images: Asset[];
  file: Asset | null;
  quote: Quote | null;
  /** Timeline, testimonials, clients, tabs… under the section's own fields. */
  blocks: Block[];
  /** Hidden sections stay in the document and off the published page. */
  hidden: boolean;
  /** Prints on the resume, under its tab as the heading. Independent of
   *  `hidden`: a section can be on the page, the resume, or both. */
  onResume: boolean;
};

/** The ids a section's galleries have claimed. */
function galleryIds(section: Pick<Section, "blocks">): Set<string> {
  return new Set((section.blocks ?? []).flatMap((b) => (b.type === "gallery" ? b.imageIds : [])));
}

/** The picture a theme leads a section with: the first one no gallery names. */
export function coverOf(section: Pick<Section, "images" | "blocks">): Asset | null {
  const claimed = galleryIds(section);
  return (section.images ?? []).find((a) => !a.id || !claimed.has(a.id)) ?? null;
}

/** A gallery's pictures, in its order. An id the section no longer holds
 *  draws nothing rather than a broken frame. */
export function galleryImages(section: Pick<Section, "images">, block: GalleryBlock): Asset[] {
  const byId = new Map((section.images ?? []).flatMap((a) => (a.id ? [[a.id, a] as const] : [])));
  return block.imageIds.flatMap((id) => byId.get(id) ?? []);
}

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

/**
 * The published-page structures. Content stays put; the frame changes.
 *
 * Five motion themes, each built around one piece of depth rather than a
 * page of effects: Aurora's floating glass, Meridian's layered portrait,
 * Stage's showreel rails, Arcade's perspective grid, Journey's stacking
 * cards. Mirrors THEMES in backend/app/models/enums.py.
 */
export type ThemeId = "aurora" | "meridian" | "stage" | "arcade" | "journey" | "bio";

export type Ground = "light" | "dark" | "paper";
export type FontId =
  | "bodoni-moda"
  | "schibsted-grotesk"
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
  | "jetbrains-mono"
  | "lexend"
  | "outfit";

/**
 * Who the page is for. The gallery and the builder start here, because "what
 * do you do?" is a question everyone can answer and "which layout?" is not.
 * It is not stored: picking one applies a look, and the look is what's saved.
 */
export type ProfessionId =
  | "doctor"
  | "advocate"
  | "business"
  | "entrepreneur"
  | "developer"
  | "gamer"
  | "musician"
  | "dancer"
  | "student"
  | "social";

export const THEMES: Array<{
  id: ThemeId;
  name: string;
  /** One line for a list row. */
  desc: string;
  /** Two sentences for the gallery card. */
  long: string;
  /** The theme's one piece of depth, said plainly. */
  depth: string;
  professions: ProfessionId[];
}> = [
  {
    id: "aurora",
    name: "Aurora",
    desc: "Glass cards floating over light",
    long: "A dark page lit from behind, with your work on glass cards that tilt toward the pointer. Reads as a product launch.",
    depth: "Cards lean in 3D under the pointer; tags orbit the portrait at three depths.",
    professions: ["developer", "entrepreneur", "business"],
  },
  {
    id: "meridian",
    name: "Meridian",
    desc: "Calm, credentialed, made to be trusted",
    long: "A light, quiet page that leads with credentials and lets testimonials speak. For the people a visitor has to trust first.",
    depth: "The portrait sits on layered plates that separate as you scroll.",
    professions: ["doctor", "advocate", "business"],
  },
  {
    id: "stage",
    name: "Stage",
    desc: "A billboard, then showreel rails",
    long: "Your portrait fills the screen, then every tab becomes a rail of posters to swipe through. For people who perform.",
    depth: "The billboard recedes as you scroll; posters turn toward the pointer.",
    professions: ["musician", "dancer"],
  },
  {
    id: "arcade",
    name: "Arcade",
    desc: "Neon, a moving grid, level select",
    long: "A synthwave horizon, a glitching name and a level-select menu for your tabs. Built for players and the people who make games.",
    depth: "A perspective grid runs to the horizon; cards flip in as you change level.",
    professions: ["gamer", "developer"],
  },
  {
    id: "journey",
    name: "Journey",
    desc: "A warm story in stacking chapters",
    long: "A friendly page told as a story: each piece of work is a card that stacks on the last as you scroll. For impact, study and growth.",
    depth: "Tags ring the portrait in a slow 3D orbit; cards stack and settle back as you read.",
    professions: ["student", "social"],
  },
  {
    id: "bio",
    name: "Bio",
    desc: "One page of links, nothing else",
    long: "Your photo, your name and a stack of link buttons — the page people already know from bio links. Sections, numbers and the timeline stay off it, whatever you have filled in.",
    depth: "Buttons lift under the pointer; the photo sits in a soft halo of your accent.",
    professions: [],
  },
];

/**
 * Each profession's starting look: a theme and the colour and type that suit
 * it. Applying one writes these fields onto the portfolio — after that they
 * are the author's like any other choice, and the profession is forgotten.
 *
 * The grounds are picked colours rather than presets: the three presets are
 * the catalogue's stocks, and none of them is the near-black a showreel
 * wants or the cream a story page does.
 */
export const PROFESSIONS: Array<{
  id: ProfessionId;
  name: string;
  /** What the page has to do for this person, in a line. */
  goal: string;
  theme: ThemeId;
  accent: string;
  groundHex: string;
  font: FontId;
  bodyFont: FontId;
}> = [
  {
    id: "doctor",
    name: "Doctor",
    goal: "Qualifications, specialties and where to book",
    theme: "meridian",
    accent: "#0e7490",
    groundHex: "#f3f7f9",
    font: "lexend",
    bodyFont: "inter",
  },
  {
    id: "advocate",
    name: "Advocate",
    goal: "Practice areas, notable matters, chambers",
    theme: "meridian",
    accent: "#7a1f2b",
    groundHex: "#f6f2ea",
    font: "playfair-display",
    bodyFont: "source-serif-4",
  },
  {
    id: "business",
    name: "Business",
    goal: "Track record, numbers and the board seats",
    theme: "aurora",
    accent: "#3b82f6",
    groundHex: "#0b1324",
    font: "manrope",
    bodyFont: "inter",
  },
  {
    id: "entrepreneur",
    name: "Entrepreneur",
    goal: "Ventures, traction, and what's next",
    theme: "aurora",
    accent: "#8b5cf6",
    groundHex: "#0a0a14",
    font: "space-grotesk",
    bodyFont: "dm-sans",
  },
  {
    id: "developer",
    name: "Developer",
    goal: "Shipped projects, stack, open source",
    theme: "aurora",
    accent: "#22c55e",
    groundHex: "#0b0f14",
    font: "jetbrains-mono",
    bodyFont: "inter",
  },
  {
    id: "gamer",
    name: "Gamer",
    goal: "Ranks, streams, teams and highlights",
    theme: "arcade",
    accent: "#ff2bd6",
    groundHex: "#07060f",
    font: "oswald",
    bodyFont: "space-grotesk",
  },
  {
    id: "musician",
    name: "Musician",
    goal: "Releases, shows and where to listen",
    theme: "stage",
    accent: "#f43f5e",
    groundHex: "#09090b",
    font: "syne",
    bodyFont: "inter",
  },
  {
    id: "dancer",
    name: "Dancer",
    goal: "Performances, reels and companies",
    theme: "stage",
    accent: "#f59e0b",
    groundHex: "#0c0a12",
    font: "playfair-display",
    bodyFont: "manrope",
  },
  {
    id: "student",
    name: "Student",
    goal: "Projects, skills and what you're learning",
    theme: "journey",
    accent: "#6366f1",
    groundHex: "#f7f7fb",
    font: "outfit",
    bodyFont: "dm-sans",
  },
  {
    id: "social",
    name: "Social work",
    goal: "Causes, impact and the people behind it",
    theme: "journey",
    accent: "#e76f51",
    groundHex: "#fbf6ef",
    font: "fraunces",
    bodyFont: "outfit",
  },
];

/** The fields a profession's look writes, applied to a portfolio. */
export function applyProfession(p: Portfolio, id: ProfessionId): Portfolio {
  const look = PROFESSIONS.find((x) => x.id === id);
  if (!look) return p;
  return {
    ...p,
    theme: look.theme,
    accent: look.accent,
    groundHex: look.groundHex,
    font: look.font,
    bodyFont: look.bodyFont,
  };
}

/**
 * The catalogue's three stocks: board, plate white, and binding cloth.
 *
 * `hex` is the ground each preset paints, duplicated from the palette map in
 * `published/shared.tsx` so the picker can show a preset as a swatch and can
 * hand the custom field somewhere to start from. The map there stays the
 * authority on the other six variables a preset sets, foil included.
 *
 * The ids stay `light` / `dark` / `paper` — wire format and stored values —
 * while Board leads the list because it is the house ground. Renaming the
 * keys would be a migration for nothing a label change does not do, which is
 * the same reason `roleNav` and `font` keep their names.
 */
export const GROUNDS: Array<{ id: Ground; name: string; hex: string }> = [
  { id: "dark", name: "Board", hex: "#16233b" },
  { id: "light", name: "Plate", hex: "#ffffff" },
  { id: "paper", name: "Cloth", hex: "#1f3a32" },
];

/**
 * The faces an author can pick, headline and body.
 *
 * The two house faces lead the list: Bodoni Moda sets the catalogue's
 * half-titles and plate numbers, Schibsted Grotesk its captions and
 * controls, and a portfolio that never opens the Type panel gets that
 * pairing. The twelve after them are opt-in alternates.
 *
 * Every face here is variable and reaches at least 700. That is the entry
 * requirement, not a coincidence: `globals.css` sets `font-weight: 700` on
 * every heading, so a single-weight family would be faux-bolded by the
 * browser and come out smeared. It is why the obvious display picks —
 * Anton, Bebas Neue, Instrument Serif — are absent.
 *
 * Ordered by kind rather than alphabetically, so scanning the list moves
 * through the house pairing, then sans, serif, slab, condensed, display, mono.
 */
export const FONTS: Array<{ id: FontId; name: string; sample: string; cssVar: string }> = [
  {
    id: "bodoni-moda",
    name: "Bodoni Moda",
    sample: "Catalogue didone",
    cssVar: "--font-bodoni-moda",
  },
  {
    id: "schibsted-grotesk",
    name: "Schibsted Grotesk",
    sample: "Caption grotesk",
    cssVar: "--font-schibsted-grotesk",
  },
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
  { id: "lexend", name: "Lexend", sample: "Clear, open sans", cssVar: "--font-lexend" },
  { id: "outfit", name: "Outfit", sample: "Friendly geometric", cssVar: "--font-outfit" },
];

/**
 * One accent runs the page — the primary action's fill, the open plate's
 * mark, the colophon field.
 *
 * Five binding colours, cloth red first because it is the house accent. A
 * picked colour overrides any of them, and `--color-mark` in
 * `published/shared.tsx` takes whatever is chosen to an instance of itself
 * the author's ground can actually hold.
 */
export const SWATCHES = ["#b5261e", "#1f3a32", "#1d3f8a", "#8a6f1f", "#5b2545"];

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

/**
 * How photographs are printed on the published page.
 *
 * "colour" is the default and was not always: every image used to run through
 * `grayscale(1) contrast(1.08)` with no way out, because the Modernist system
 * called for black-and-white photography. That reads as a print convention
 * from a long way back on a page whose whole job is showing somebody's work,
 * so the treatment became the author's to pick. Stored portfolios that never
 * chose one get "colour" — this is a deliberate change of look for existing
 * pages, not a backfill of what they had.
 */
export type PhotoTreatment = "colour" | "bw";

export const PHOTO_TREATMENTS: Array<{ id: PhotoTreatment; name: string }> = [
  { id: "colour", name: "Colour" },
  { id: "bw", name: "Black & white" },
];

/**
 * How much the published page moves. "full" is every theme's depth and
 * motion; "subtle" keeps the reveals and drops the pointer tilt, parallax and
 * ambient loops; "off" is a still page. A visitor's own reduced-motion
 * setting caps it at "off" whatever the author picked — see `useMotionLevel`.
 */
export type MotionLevel = "full" | "subtle" | "off";

export const MOTION_LEVELS: Array<{ id: MotionLevel; name: string; desc: string }> = [
  { id: "full", name: "Full", desc: "Depth, tilt, parallax and ambient motion." },
  { id: "subtle", name: "Subtle", desc: "Content eases in. Nothing follows the pointer." },
  { id: "off", name: "Still", desc: "No motion at all. Everything is simply there." },
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
  photo: PhotoTreatment;
  motion: MotionLevel;
};

export function defaultLayout(): Layout {
  return {
    roleNav: "tabs",
    grid: 2,
    density: "standard",
    scale: "default",
    tracking: DEFAULT_TRACKING,
    photo: "colour",
    motion: "full",
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
  /** When the server last saved it, ISO 8601. Absent on seed and stored-locally data. */
  updatedAt?: string;
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
  /** The document this portfolio downloads as. Never on the published page. */
  resume: Resume;
  header: PortfolioHeader;
  footer: Footer;
  sections: Section[];
};

const THEME_IDS = new Set<string>(THEMES.map((t) => t.id));

/** The theme a new or unrecognised portfolio renders in. */
export const DEFAULT_THEME: ThemeId = "aurora";

/**
 * The catalogue themes and the motion theme that took each one's place.
 * Mirrors LEGACY_THEMES in backend/app/models/enums.py and the migration
 * that retired them; kept here for data that reaches the page without
 * passing through that migration.
 */
const LEGACY_THEMES: Record<string, ThemeId> = {
  editorial: "aurora",
  site: "aurora",
  resume: "meridian",
  poster: "stage",
  links: "journey",
};

/** Fills in fields added after a portfolio was first stored. */
export function normalize(p: Portfolio): Portfolio {
  const layout = { ...defaultLayout(), ...(p.layout ?? {}) };
  const theme = LEGACY_THEMES[p.theme] ?? p.theme;
  return {
    ...p,
    // An unknown theme means data from a build that had one we've since
    // dropped; fall back rather than render nothing.
    theme: THEME_IDS.has(theme) ? theme : DEFAULT_THEME,
    accent: p.accent ?? SWATCHES[0],
    // Board, not plate white. A portfolio stored without a ground is being
    // backfilled, and the ground the house prints on is the honest answer to
    // "this was never chosen" — the same call the photo treatment made when
    // it stopped forcing black and white.
    ground: p.ground ?? "dark",
    groundHex: isHexColour(p.groundHex) ? p.groundHex : "",
    font: p.font ?? "bodoni-moda",
    bodyFont: p.bodyFont ?? "schibsted-grotesk",
    layout: {
      roleNav: layout.roleNav ?? "tabs",
      grid: layout.grid ?? 2,
      density: layout.density ?? "standard",
      scale: layout.scale ?? "default",
      tracking: layout.tracking ?? DEFAULT_TRACKING,
      photo: layout.photo ?? "colour",
      motion: layout.motion ?? "full",
    },
    resume: normalizeResume(p.resume),
    header: {
      ...emptyHeader(),
      ...(p.header ?? {}),
      numbers: p.header?.numbers ?? [],
      dates: p.header?.dates ?? [],
    },
    footer: { ...emptyFooter(), ...(p.footer ?? {}), links: p.footer?.links ?? [] },
    sections: (p.sections ?? []).map((s) => sectionOf(s)),
  };
}

/** One section from any build: a single `image` from before pictures were a
 *  list becomes the cover, and pictures stored before galleries were a
 *  component — when everything after the first was "the gallery" — get the
 *  gallery that says so. Its id is derived, so reading twice agrees. */
function sectionOf(raw: Section & { image?: Asset | null }): Section {
  const { image, ...s } = raw;
  const images = s.images ?? (image ? [image] : []);
  let blocks = (s.blocks ?? []).map((b) => (b.type === "gallery" ? { ...b, layout: b.layout ?? "mosaic", imageIds: b.imageIds ?? [] } : b));
  const loose = images.slice(1).flatMap((a) => (a.id ? [a.id] : []));
  if (loose.length > 0 && blocks.length < SECTION_BLOCKS_MAX && !blocks.some((b) => b.type === "gallery")) {
    blocks = [{ id: `gallery-${s.id}`, type: "gallery", title: "", layout: "mosaic", imageIds: loose }, ...blocks];
  }
  return {
      ...emptySection(s.id),
      ...s,
      images,
      blocks,
      links: s.links ?? [],
      // Whatever was stored, the menu label is the title.
      tab: tabOf({ title: s.title ?? "" }),
      hidden: s.hidden ?? false,
      onResume: s.onResume ?? true,
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
    images: [],
    file: null,
    quote: null,
    blocks: [],
    hidden: false,
    onResume: true,
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

/* ── the resume ───────────────────────────────────────────────────────────
   One content list, two looks. The header is the resume's top — its name,
   current line and About are the resume's name, headline and summary — and
   the page's own sections print under their tabs. What lives here are the
   facts a page section has no fields for — a role's company and dates, a
   school, a list of skills — structured, so a later ATS check can read them
   without parsing prose. Each structured list can also go on the page, by
   placing its component in a section (`ResumeListBlock`). Mirrors
   backend/app/schemas/resume.py.
   ──────────────────────────────────────────────────────────────────────── */

/** Every template, in catalogue order. `lib/resume.ts` describes each one. */
export const RESUME_TEMPLATE_IDS = [
  "classic",
  "ivy",
  "timeline",
  "compact",
  "sidebar",
  "modern",
  "executive",
  "scholar",
  "minimal",
  "swiss",
  "banner",
  "slate",
  "vivid",
  "engineer",
  "elegant",
  "bold",
  "contemporary",
  "corporate",
  "startup",
  "columns",
  "simple",
  "graduate",
  "senior",
  "portrait",
  "chronicle",
  "pathway",
  "nordic",
  "editorial",
  "ledger",
  "monogram",
  "cobalt",
  "harbor",
] as const;
export type ResumeTemplateId = (typeof RESUME_TEMPLATE_IDS)[number];
export type Paper = "a4" | "letter";
export type ResumeSize = "small" | "medium" | "large";
export type ResumeSpacing = "compact" | "standard" | "airy";
/** `auto` follows the template; anything else overrides its columns. */
export const RESUME_COLUMNS = ["auto", "one", "left", "right", "half"] as const;
export type ResumeColumns = (typeof RESUME_COLUMNS)[number];
/** Decoration behind the text. `lib/resume-backdrops.ts` draws each one. */
export const RESUME_BACKDROP_IDS = [
  "none",
  "dots",
  "grid",
  "diagonal",
  "hexagons",
  "topography",
  "waves",
  "triangles",
  "plus",
  "edge",
  "cream",
  "wash",
  "rainbow",
  "arcs",
  "circles",
  "lines",
] as const;
export type ResumeBackdrop = (typeof RESUME_BACKDROP_IDS)[number];
export type ResumeBlock =
  | "summary"
  | "experience"
  | "education"
  | "projects"
  | "skills"
  | "certifications"
  | "languages"
  | "awards";

/** The structured lists — the ones a component can place on the page. */
export type PageBlock = "experience" | "education" | "skills" | "certifications" | "languages" | "awards";
export const PAGE_BLOCKS: PageBlock[] = ["experience", "education", "skills", "certifications", "languages", "awards"];

/** The looks each list can take on the page; the first is its default.
 *  A stored look a list does not have falls back to that default. */
export const LIST_LOOKS: Record<PageBlock, ListLook[]> = {
  experience: ["timeline", "cards", "list"],
  education: ["list", "cards", "timeline"],
  skills: ["tags", "list"],
  certifications: ["list", "cards"],
  languages: ["tags", "list"],
  awards: ["list", "cards", "timeline"],
};

export function isListBlock(b: Block): b is ResumeListBlock {
  return (PAGE_BLOCKS as string[]).includes(b.type);
}

/** The look a list component draws in: its own, if its list has it. */
export function lookOf(b: ResumeListBlock): ListLook {
  return LIST_LOOKS[b.type].includes(b.look) ? b.look : LIST_LOOKS[b.type][0];
}

export const RESUME_BLOCKS: ResumeBlock[] = [
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "languages",
  "awards",
];

export type ExperienceItem = {
  id: string;
  role: string;
  company: string;
  location: string;
  start: string;
  end: string;
  current: boolean;
  bullets: string[];
};
export type EducationItem = {
  id: string;
  degree: string;
  school: string;
  location: string;
  start: string;
  end: string;
  detail: string;
};
export type SkillGroup = { id: string; name: string; items: string[] };
export type Certification = { id: string; name: string; issuer: string; date: string; url: string };
export type Language = { id: string; name: string; level: string };
export type Award = { id: string; title: string; issuer: string; date: string; detail: string };

export type ResumeStyle = {
  template: ResumeTemplateId;
  paper: Paper;
  accent: string;
  headingFont: FontId;
  font: FontId;
  size: ResumeSize;
  spacing: ResumeSpacing;
  photo: boolean;
  columns: ResumeColumns;
  backdrop: ResumeBackdrop;
};

export type Resume = {
  /** Resume-only: printed on the resume, never sent to a visitor. */
  email: string;
  phone: string;
  location: string;
  website: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillGroup[];
  certifications: Certification[];
  languages: Language[];
  awards: Award[];
  /** Block order on the sheet. */
  order: ResumeBlock[];
  /** Blocks left off the resume. */
  hidden: ResumeBlock[];
  style: ResumeStyle;
};

export function defaultResumeStyle(): ResumeStyle {
  return {
    template: "classic",
    paper: "a4",
    accent: "#1d3f8a",
    headingFont: "inter",
    font: "inter",
    size: "medium",
    spacing: "standard",
    photo: false,
    columns: "auto",
    backdrop: "none",
  };
}

export function defaultResume(): Resume {
  return {
    email: "",
    phone: "",
    location: "",
    website: "",
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    awards: [],
    order: [...RESUME_BLOCKS],
    hidden: [],
    style: defaultResumeStyle(),
  };
}

/** Backfills a resume from any build, and keeps every block in the order once. */
export function normalizeResume(raw: Partial<Resume> | null | undefined): Resume {
  const base = defaultResume();
  // `headline` and `summary` moved to the header, and `pageBlocks` gave way
  // to components placed in sections; a stale copy of any is dropped — the
  // API refuses a key it no longer has.
  const { headline: _h, summary: _s, pageBlocks: _p, ...rest } = (raw ?? {}) as Partial<Resume> & {
    headline?: string;
    summary?: string;
    pageBlocks?: string[];
  };
  void _h;
  void _s;
  void _p;
  const r = { ...base, ...rest };
  const known = new Set<string>(RESUME_BLOCKS);
  const order = [...new Set((r.order ?? []).filter((b) => known.has(b)))] as ResumeBlock[];
  for (const b of RESUME_BLOCKS) if (!order.includes(b)) order.push(b);
  return {
    ...r,
    experience: (r.experience ?? []).map((e) => ({ ...e, bullets: e.bullets ?? [], current: !!e.current })),
    education: r.education ?? [],
    skills: (r.skills ?? []).map((g) => ({ ...g, items: g.items ?? [] })),
    certifications: r.certifications ?? [],
    languages: r.languages ?? [],
    awards: r.awards ?? [],
    order,
    hidden: (r.hidden ?? []).filter((b) => known.has(b)) as ResumeBlock[],
    style: normalizeResumeStyle({ ...base.style, ...(r.style ?? {}) }),
  };
}

/** A template, layout or background this build no longer has falls back to the default rather than unstyled. */
function normalizeResumeStyle(style: ResumeStyle): ResumeStyle {
  const known = <T extends string>(list: readonly T[], v: string, fallback: T): T =>
    (list as readonly string[]).includes(v) ? (v as T) : fallback;
  return {
    ...style,
    template: known(RESUME_TEMPLATE_IDS, style.template, "classic"),
    columns: known(RESUME_COLUMNS, style.columns, "auto"),
    backdrop: known(RESUME_BACKDROP_IDS, style.backdrop, "none"),
  };
}
