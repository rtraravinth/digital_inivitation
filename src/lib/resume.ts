import {
  FONTS,
  isListBlock,
  type FontId,
  type PageBlock,
  type Paper,
  type Portfolio,
  type Resume,
  type ResumeBlock,
  type ResumeColumns,
  type ResumeSize,
  type ResumeSpacing,
  type ResumeTemplateId,
  type Section,
} from "./types";

/* ── resume catalogue and helpers ─────────────────────────────────────────
   Everything the templates share, so every layout reads one set of facts
   the same way: what a block is called, how a date range reads, which links
   count as contact details, how big a sheet is.
   ──────────────────────────────────────────────────────────────────────── */

/**
 * A template is a combination of parts, not a stylesheet of its own. Each
 * part is a `data-*` attribute on the sheet that `resume.css` styles once —
 * so thirty-odd templates are thirty-odd rows here, every one of them prints
 * the same markup in the same reading order, and a new one is usually a new
 * row rather than new CSS. A few carry a finishing touch keyed off
 * `data-template`; keep those small.
 */
export type TemplateParts = {
  /** `left` / `right` put Skills, Certifications, Languages and Awards in a narrow column. */
  layout: "one" | "left" | "right";
  /** The narrow column's ground. `solid` runs the accent down the whole sheet. */
  aside: "tint" | "rule" | "solid" | "plain";
  header: "rule" | "thin" | "accent" | "plain" | "center" | "band" | "split" | "boxed" | "bar";
  heading: "underline" | "ink" | "line" | "margin" | "bar" | "block" | "tab" | "plain" | "serif" | "center" | "wash";
  /** `org` leads with the organisation; `timeline` and `gutter` set the dates in a left gutter. */
  entry: "role" | "org" | "timeline" | "gutter";
  skills: "lines" | "chips" | "solid";
  contact: "icons" | "dots";
};

export type TemplateCategory =
  | "ats"
  | "simple"
  | "traditional"
  | "modern"
  | "creative"
  | "minimal"
  | "professional"
  | "two-column"
  | "photo"
  | "timeline"
  | "entry";

export const TEMPLATE_CATEGORIES: Array<{ id: TemplateCategory; name: string }> = [
  { id: "ats", name: "ATS-friendly" },
  { id: "simple", name: "Simple" },
  { id: "traditional", name: "Traditional" },
  { id: "modern", name: "Modern" },
  { id: "creative", name: "Creative" },
  { id: "minimal", name: "Minimal" },
  { id: "professional", name: "Senior" },
  { id: "two-column", name: "Two columns" },
  { id: "photo", name: "With photo" },
  { id: "timeline", name: "Timeline" },
  { id: "entry", name: "Entry level" },
];

export type ResumeTemplate = TemplateParts & {
  id: ResumeTemplateId;
  name: string;
  desc: string;
  categories: TemplateCategory[];
  /** The starting look — applied when the template is picked, then editable. */
  defaults: { headingFont: FontId; font: FontId; accent: string };
};

const ONE = { layout: "one", aside: "plain", skills: "lines", contact: "icons", entry: "role" } as const;

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    ...ONE,
    id: "classic",
    name: "Classic",
    desc: "Clean single column. Safe for any reader, human or machine.",
    categories: ["ats", "simple"],
    header: "rule",
    heading: "underline",
    defaults: { headingFont: "inter", font: "inter", accent: "#1d3f8a" },
  },
  {
    ...ONE,
    id: "ivy",
    name: "Ivy League",
    desc: "Centred name, ruled headings, serif. The traditional choice.",
    categories: ["ats", "traditional"],
    header: "center",
    heading: "ink",
    entry: "org",
    contact: "dots",
    defaults: { headingFont: "source-serif-4", font: "source-serif-4", accent: "#111111" },
  },
  {
    ...ONE,
    id: "timeline",
    name: "Timeline",
    desc: "Dates down the left, a line joining every role.",
    categories: ["timeline", "modern"],
    header: "plain",
    heading: "line",
    entry: "timeline",
    defaults: { headingFont: "manrope", font: "manrope", accent: "#0f766e" },
  },
  {
    ...ONE,
    id: "compact",
    name: "Compact",
    desc: "Headings in the margin. Fits the most on one page.",
    categories: ["ats", "simple"],
    header: "accent",
    heading: "margin",
    defaults: { headingFont: "dm-sans", font: "dm-sans", accent: "#334155" },
  },
  {
    id: "sidebar",
    name: "Sidebar",
    desc: "Contact and skills in a tinted column beside your work.",
    categories: ["two-column", "photo"],
    layout: "left",
    aside: "tint",
    header: "thin",
    heading: "underline",
    entry: "role",
    skills: "chips",
    contact: "icons",
    defaults: { headingFont: "fraunces", font: "lora", accent: "#1f3a32" },
  },
  {
    id: "modern",
    name: "Modern",
    desc: "Bold header with photo, two columns below.",
    categories: ["modern", "two-column", "photo"],
    layout: "right",
    aside: "rule",
    header: "accent",
    heading: "bar",
    entry: "role",
    skills: "chips",
    contact: "icons",
    defaults: { headingFont: "outfit", font: "dm-sans", accent: "#5b2545" },
  },
  {
    ...ONE,
    id: "executive",
    name: "Executive",
    desc: "Display serif, centred under a double rule. For a long record.",
    categories: ["traditional", "professional"],
    header: "center",
    heading: "serif",
    entry: "org",
    contact: "dots",
    defaults: { headingFont: "playfair-display", font: "source-serif-4", accent: "#0b2545" },
  },
  {
    ...ONE,
    id: "scholar",
    name: "Scholar",
    desc: "Bookish serif with headings centred between rules. Academic CVs.",
    categories: ["ats", "traditional"],
    header: "center",
    heading: "center",
    entry: "org",
    contact: "dots",
    defaults: { headingFont: "lora", font: "lora", accent: "#3b2f2a" },
  },
  {
    ...ONE,
    id: "minimal",
    name: "Minimal",
    desc: "No rules, quiet grey headings and room to breathe.",
    categories: ["minimal", "ats", "simple"],
    header: "plain",
    heading: "plain",
    contact: "dots",
    defaults: { headingFont: "inter", font: "inter", accent: "#111111" },
  },
  {
    ...ONE,
    id: "swiss",
    name: "Swiss",
    desc: "An oversized name and headings in the margin, on a strict grid.",
    categories: ["minimal", "modern"],
    header: "plain",
    heading: "margin",
    defaults: { headingFont: "archivo", font: "archivo", accent: "#c8102e" },
  },
  {
    ...ONE,
    id: "banner",
    name: "Banner",
    desc: "Your name on a full-width band of colour.",
    categories: ["modern", "professional"],
    header: "band",
    heading: "underline",
    defaults: { headingFont: "manrope", font: "manrope", accent: "#1e3a8a" },
  },
  {
    id: "slate",
    name: "Slate",
    desc: "A dark column down the left for contact, photo and skills.",
    categories: ["two-column", "photo", "modern"],
    layout: "left",
    aside: "solid",
    header: "plain",
    heading: "bar",
    entry: "role",
    skills: "chips",
    contact: "icons",
    defaults: { headingFont: "dm-sans", font: "dm-sans", accent: "#1f2937" },
  },
  {
    id: "vivid",
    name: "Vivid",
    desc: "Filled headings and a column of colour on the right.",
    categories: ["creative", "two-column"],
    layout: "right",
    aside: "solid",
    header: "plain",
    heading: "block",
    entry: "role",
    skills: "solid",
    contact: "icons",
    defaults: { headingFont: "outfit", font: "outfit", accent: "#b4441a" },
  },
  {
    ...ONE,
    id: "engineer",
    name: "Engineer",
    desc: "Monospace headings and skill tags. Reads like good documentation.",
    categories: ["modern", "simple"],
    header: "accent",
    heading: "tab",
    skills: "chips",
    defaults: { headingFont: "jetbrains-mono", font: "inter", accent: "#0f766e" },
  },
  {
    ...ONE,
    id: "elegant",
    name: "Elegant",
    desc: "Soft serif, centred throughout, organisation first.",
    categories: ["traditional", "creative"],
    header: "center",
    heading: "center",
    entry: "org",
    contact: "dots",
    defaults: { headingFont: "fraunces", font: "lora", accent: "#6b4f2a" },
  },
  {
    ...ONE,
    id: "bold",
    name: "Bold",
    desc: "Heavy type, a bar beside your name and filled headings.",
    categories: ["creative", "modern"],
    header: "bar",
    heading: "block",
    skills: "solid",
    defaults: { headingFont: "archivo", font: "inter", accent: "#111111" },
  },
  {
    ...ONE,
    id: "contemporary",
    name: "Contemporary",
    desc: "Name on the left, contact stacked on the right.",
    categories: ["modern", "professional"],
    header: "split",
    heading: "line",
    defaults: { headingFont: "lexend", font: "lexend", accent: "#2457c5" },
  },
  {
    ...ONE,
    id: "corporate",
    name: "Corporate",
    desc: "A tinted header panel over a plain, ordered page.",
    categories: ["professional", "ats"],
    header: "boxed",
    heading: "underline",
    defaults: { headingFont: "inter", font: "inter", accent: "#0f3d5e" },
  },
  {
    ...ONE,
    id: "startup",
    name: "Startup",
    desc: "Friendly geometric type, tabbed headings, skill tags.",
    categories: ["modern", "entry"],
    header: "accent",
    heading: "tab",
    skills: "solid",
    defaults: { headingFont: "outfit", font: "inter", accent: "#6d28d9" },
  },
  {
    id: "columns",
    name: "Columns",
    desc: "Work on the left, a ruled column of skills on the right.",
    categories: ["two-column", "simple"],
    layout: "right",
    aside: "rule",
    header: "rule",
    heading: "underline",
    entry: "role",
    skills: "chips",
    contact: "icons",
    defaults: { headingFont: "schibsted-grotesk", font: "inter", accent: "#334155" },
  },
  {
    ...ONE,
    id: "simple",
    name: "Simple",
    desc: "Black ink only, no icons. The plainest thing that still looks right.",
    categories: ["ats", "simple", "minimal"],
    header: "rule",
    heading: "ink",
    contact: "dots",
    defaults: { headingFont: "inter", font: "inter", accent: "#111111" },
  },
  {
    ...ONE,
    id: "graduate",
    name: "Graduate",
    desc: "Centred and open, for a first role or an internship.",
    categories: ["entry", "simple"],
    header: "center",
    heading: "tab",
    skills: "chips",
    defaults: { headingFont: "lexend", font: "lexend", accent: "#0e7490" },
  },
  {
    ...ONE,
    id: "senior",
    name: "Senior",
    desc: "Serif headings, organisation first, contact to the right.",
    categories: ["professional", "traditional"],
    header: "split",
    heading: "serif",
    entry: "org",
    defaults: { headingFont: "source-serif-4", font: "inter", accent: "#1f2937" },
  },
  {
    id: "portrait",
    name: "Portrait",
    desc: "A coloured band with your photo, a tinted column below.",
    categories: ["photo", "two-column", "creative"],
    layout: "left",
    aside: "tint",
    header: "band",
    heading: "bar",
    entry: "role",
    skills: "chips",
    contact: "icons",
    defaults: { headingFont: "manrope", font: "manrope", accent: "#0f4c5c" },
  },
  {
    ...ONE,
    id: "chronicle",
    name: "Chronicle",
    desc: "Dates in a gutter of their own, slab-serif headings.",
    categories: ["timeline", "professional"],
    header: "rule",
    heading: "line",
    entry: "gutter",
    defaults: { headingFont: "bitter", font: "inter", accent: "#7f1d1d" },
  },
  {
    id: "pathway",
    name: "Pathway",
    desc: "A timeline of roles beside a column of skills.",
    categories: ["timeline", "two-column"],
    layout: "right",
    aside: "rule",
    header: "accent",
    heading: "line",
    entry: "timeline",
    skills: "chips",
    contact: "icons",
    defaults: { headingFont: "lexend", font: "lexend", accent: "#1d4ed8" },
  },
  {
    ...ONE,
    id: "nordic",
    name: "Nordic",
    desc: "Headings on a pale wash of colour, lots of white.",
    categories: ["minimal", "modern"],
    header: "plain",
    heading: "wash",
    skills: "solid",
    defaults: { headingFont: "lexend", font: "lexend", accent: "#155e75" },
  },
  {
    ...ONE,
    id: "editorial",
    name: "Editorial",
    desc: "A magazine headline of a name over serif sections.",
    categories: ["creative", "traditional"],
    header: "plain",
    heading: "serif",
    contact: "dots",
    defaults: { headingFont: "playfair-display", font: "lora", accent: "#111111" },
  },
  {
    ...ONE,
    id: "ledger",
    name: "Ledger",
    desc: "Margin headings behind a ruled line, slab and sans.",
    categories: ["ats", "professional"],
    header: "rule",
    heading: "margin",
    defaults: { headingFont: "roboto-slab", font: "inter", accent: "#374151" },
  },
  {
    ...ONE,
    id: "monogram",
    name: "Monogram",
    desc: "Your initials in a ring where a photo would be.",
    categories: ["creative", "simple"],
    header: "center",
    heading: "underline",
    entry: "org",
    contact: "dots",
    defaults: { headingFont: "fraunces", font: "inter", accent: "#3f3f46" },
  },
  {
    id: "cobalt",
    name: "Cobalt",
    desc: "A full-height column of colour with your photo at the top.",
    categories: ["two-column", "photo", "modern"],
    layout: "left",
    aside: "solid",
    header: "plain",
    heading: "underline",
    entry: "role",
    skills: "chips",
    contact: "icons",
    defaults: { headingFont: "inter", font: "inter", accent: "#1e40af" },
  },
  {
    id: "harbor",
    name: "Harbor",
    desc: "A tinted header panel and a tinted column for skills.",
    categories: ["two-column", "professional"],
    layout: "right",
    aside: "tint",
    header: "boxed",
    heading: "bar",
    entry: "role",
    skills: "chips",
    contact: "icons",
    defaults: { headingFont: "dm-sans", font: "dm-sans", accent: "#0f766e" },
  },
];

export function templateOf(id: ResumeTemplateId): ResumeTemplate {
  return RESUME_TEMPLATES.find((t) => t.id === id) ?? RESUME_TEMPLATES[0];
}

/** A starting look per template — applied when one is picked, then editable. */
export const TEMPLATE_DEFAULTS = Object.fromEntries(RESUME_TEMPLATES.map((t) => [t.id, t.defaults])) as Record<
  ResumeTemplateId,
  ResumeTemplate["defaults"]
>;

/** Width of the narrow column, in mm. */
export const ASIDE_MM = { tint: 58, rule: 56, solid: 60, plain: 56 } as const;
/** Gap between the columns, in mm — wider when the aside is solid colour, so its text keeps clear of the edge. */
export const COLUMN_GAP_MM = { tint: 7, rule: 8, solid: 12, plain: 7 } as const;

export const COLUMN_OPTIONS: Array<{ id: ResumeColumns; name: string }> = [
  { id: "auto", name: "Template" },
  { id: "one", name: "One column" },
  { id: "left", name: "Narrow left" },
  { id: "right", name: "Narrow right" },
  { id: "half", name: "Two equal" },
];

/**
 * The parts a sheet is actually drawn with: its template's, with the
 * author's Columns choice laid over them. A one-column template switched to
 * two columns gets a ruled column (its own aside is `plain`, which reads as
 * no column at all), and "Two equal" is a right-hand column as wide as the
 * main one. The DOM order never changes — only where the blocks sit.
 */
export function sheetParts(resume: Resume) {
  const t = templateOf(resume.style.template);
  const pick = resume.style.columns ?? "auto";
  const layout: TemplateParts["layout"] =
    pick === "auto" ? t.layout : pick === "half" ? "right" : pick;
  const aside: TemplateParts["aside"] = layout !== "one" && t.layout === "one" ? "rule" : t.aside;
  const m = sheetMetrics(resume);
  const colGap = COLUMN_GAP_MM[aside];
  const asideW = pick === "half" ? (m.paper.w - 2 * m.marginX - colGap) / 2 : ASIDE_MM[aside];
  return { ...t, layout, aside, asideW, colGap };
}

/**
 * The paper's own ground. White, except under a solid column, where the
 * accent runs from the paper's edge to halfway across the gutter. It is a
 * gradient on the sheet rather than a background on the column so it covers
 * the full height of every page — and `/resume/[id]` paints the same
 * gradient on the printed page itself, or the column would stop where its
 * text does.
 */
export function paperGround(resume: Resume): string {
  const t = sheetParts(resume);
  if (t.layout === "one" || t.aside !== "solid") return "#fff";
  const m = sheetMetrics(resume);
  const edge = m.marginX + t.asideW + t.colGap / 2;
  const dir = t.layout === "left" ? "90deg" : "270deg";
  return `linear-gradient(${dir}, ${resume.style.accent} 0 ${edge}mm, #fff ${edge}mm)`;
}

/** "Rohan Iyer" → "RI": what Monogram sets where a photo would go. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export const RESUME_ACCENTS = ["#111111", "#1d3f8a", "#0f766e", "#1f3a32", "#5b2545", "#b5261e", "#8a6f1f", "#334155"];

/** Faces that hold up at 10pt for a page of prose. */
export const RESUME_FONTS: FontId[] = [
  "inter",
  "dm-sans",
  "manrope",
  "lexend",
  "outfit",
  "archivo",
  "schibsted-grotesk",
  "source-serif-4",
  "lora",
  "fraunces",
  "bitter",
  "roboto-slab",
  "playfair-display",
  "space-grotesk",
];

export const BLOCK_LABEL: Record<ResumeBlock, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  projects: "Your sections",
  skills: "Skills",
  certifications: "Certifications",
  languages: "Languages",
  awards: "Awards",
};

/** Blocks a two-column template sets in its narrow column. */
export const SIDE_BLOCKS = new Set<ResumeBlock>(["skills", "certifications", "languages", "awards"]);

export const PAPERS: Record<Paper, { name: string; w: number; h: number; css: string }> = {
  a4: { name: "A4", w: 210, h: 297, css: "A4" },
  letter: { name: "US Letter", w: 215.9, h: 279.4, css: "letter" },
};

export const SIZES: Array<{ id: ResumeSize; name: string; pt: number }> = [
  { id: "small", name: "Small", pt: 9.5 },
  { id: "medium", name: "Medium", pt: 10.5 },
  { id: "large", name: "Large", pt: 11.5 },
];

export const SPACINGS: Array<{ id: ResumeSpacing; name: string; margin: number; gap: number }> = [
  { id: "compact", name: "Compact", margin: 11, gap: 0.75 },
  { id: "standard", name: "Standard", margin: 15, gap: 1 },
  { id: "airy", name: "Airy", margin: 19, gap: 1.3 },
];

/** Millimetres to CSS pixels at 96dpi — what the preview measures in. */
export const MM = 96 / 25.4;

export function sheetMetrics(resume: Resume) {
  const paper = PAPERS[resume.style.paper];
  const spacing = SPACINGS.find((s) => s.id === resume.style.spacing) ?? SPACINGS[1];
  const size = SIZES.find((s) => s.id === resume.style.size) ?? SIZES[1];
  return {
    paper,
    /** Top and bottom margin of every page, in mm — also the printer's @page margin. */
    marginY: spacing.margin,
    marginX: spacing.margin + 3,
    gap: spacing.gap,
    pt: size.pt,
  };
}

export function faceVar(id: FontId): string {
  const font = FONTS.find((f) => f.id === id);
  return font ? `var(${font.cssVar}), system-ui, sans-serif` : "system-ui, sans-serif";
}

/** "2019 – Present", "2016 – 2020", "2021", or nothing. */
export function dateRange(start: string, end: string, current = false): string {
  const to = current ? "Present" : end.trim();
  const from = start.trim();
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

/** An address as it reads on paper: no protocol, no trailing slash. */
export function bareUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

export function hrefFor(url: string): string {
  const u = url.trim();
  if (!u) return "";
  if (/^mailto:|^tel:|^https?:\/\//i.test(u)) return u;
  if (u.includes("@") && !u.includes("/")) return `mailto:${u}`;
  return `https://${u}`;
}

export type ContactItem = { kind: "email" | "phone" | "location" | "link"; text: string; href?: string };

/** The contact line: the resume's own fields, then the page header's links. */
export function contactItems(p: Portfolio): ContactItem[] {
  const r = p.resume;
  const items: ContactItem[] = [];
  if (r.email.trim()) items.push({ kind: "email", text: r.email.trim(), href: `mailto:${r.email.trim()}` });
  if (r.phone.trim()) items.push({ kind: "phone", text: r.phone.trim(), href: `tel:${r.phone.replace(/[^\d+]/g, "")}` });
  if (r.location.trim()) items.push({ kind: "location", text: r.location.trim() });
  const seen = new Set<string>();
  const links = [r.website, ...p.header.links.map((l) => l.url)];
  for (const url of links) {
    const text = bareUrl(url?.trim() ?? "");
    // An email address in the header's links is already the email above.
    if (!text || seen.has(text) || text.startsWith("mailto:") || text === r.email.trim()) continue;
    seen.add(text);
    items.push({ kind: "link", text, href: hrefFor(url) });
  }
  return items;
}

export type ProjectItem = { id: string; title: string; tab: string; description: string; url: string };

/** What the resume calls the page's own sections. */
export const PROJECTS_HEADING = "Projects";

/**
 * The page's own sections switched on for the resume, as entries under one
 * heading. Still a list of groups, because that is the shape the sheet
 * draws; there is one group now that a section is filed under nothing but
 * its own title.
 */
export function sectionGroups(p: Portfolio): Array<{ tab: string; items: ProjectItem[] }> {
  const items: ProjectItem[] = [];
  for (const s of p.sections) {
    if (!s.onResume || !(s.title.trim() || s.description.trim())) continue;
    // A section that is only a title over its components has nothing for
    // the resume: it prints no component but its own lists, and those it
    // prints itself. The bare title would be an entry with nothing under it.
    if (!s.description.trim() && s.links.length === 0 && s.blocks.length > 0) continue;
    items.push({
      id: s.id,
      title: s.title.trim(),
      tab: PROJECTS_HEADING,
      description: s.description.trim(),
      url: s.links[0]?.url ?? "",
    });
  }
  return items.length > 0 ? [{ tab: PROJECTS_HEADING, items }] : [];
}

/** The header is the resume's top: no second copy to keep in step. */
export function headlineOf(p: Portfolio): string {
  return p.header.current.trim();
}

export function summaryOf(p: Portfolio): string {
  return p.header.description.trim();
}

/** Whether a block has anything to print — an empty heading is worse than none. */
export function blockHasContent(p: Portfolio, block: ResumeBlock): boolean {
  const r = p.resume;
  switch (block) {
    case "summary":
      return !!summaryOf(p);
    case "experience":
      return r.experience.some((e) => e.role.trim() || e.company.trim());
    case "education":
      return r.education.some((e) => e.degree.trim() || e.school.trim());
    case "projects":
      return sectionGroups(p).length > 0;
    case "skills":
      return r.skills.some((g) => g.items.some((i) => i.trim()));
    case "certifications":
      return r.certifications.some((c) => c.name.trim());
    case "languages":
      return r.languages.some((l) => l.name.trim());
    case "awards":
      return r.awards.some((a) => a.title.trim());
  }
}

/** The blocks this sheet prints, in order. */
export function visibleBlocks(p: Portfolio): ResumeBlock[] {
  return p.resume.order.filter((b) => !p.resume.hidden.includes(b) && blockHasContent(p, b));
}

/* ── the resume's lists on the page ─────────────────────────────────────
   A list reaches the page through a component placed in a section
   (`ResumeListBlock`). The component holds no entries, so the page asks
   here for them, already in the one shape every look draws: a title, the
   line under it, a date, any further lines, and tags.
   ──────────────────────────────────────────────────────────────────────── */

export type ListEntry = {
  id: string;
  title: string;
  /** Where or from whom: the company, the school, the issuer. */
  sub: string;
  /** When. */
  date: string;
  /** Bullet points or a detail line. */
  lines: string[];
  /** Skills in a group, or languages with their level. */
  tags: string[];
  url: string;
};

const line = (...parts: string[]) => parts.map((s) => s.trim()).filter(Boolean).join(" · ");
const entry = (e: Partial<ListEntry> & { id: string; title: string }): ListEntry => ({ sub: "", date: "", lines: [], tags: [], url: "", ...e });

/** One list's entries as the page draws them; blank rows drop out. */
export function listEntries(resume: Resume, list: PageBlock): ListEntry[] {
  switch (list) {
    case "experience":
      return resume.experience
        .filter((e) => e.role.trim() || e.company.trim())
        .map((e) =>
          entry({
            id: e.id,
            title: e.role.trim() || e.company.trim(),
            sub: line(e.role.trim() ? e.company : "", e.location),
            date: dateRange(e.start, e.end, e.current),
            lines: e.bullets.map((b) => b.trim().replace(/^[-•*]\s*/, "")).filter(Boolean),
          }),
        );
    case "education":
      return resume.education
        .filter((e) => e.degree.trim() || e.school.trim())
        .map((e) =>
          entry({
            id: e.id,
            title: e.degree.trim() || e.school.trim(),
            sub: line(e.degree.trim() ? e.school : "", e.location),
            date: dateRange(e.start, e.end),
            lines: e.detail.trim() ? [e.detail.trim()] : [],
          }),
        );
    case "skills":
      return resume.skills
        .map((g) => entry({ id: g.id, title: g.name.trim(), tags: g.items.map((i) => i.trim()).filter(Boolean) }))
        .filter((g) => g.tags.length > 0);
    case "certifications":
      return resume.certifications
        .filter((c) => c.name.trim())
        .map((c) => entry({ id: c.id, title: c.name.trim(), sub: c.issuer.trim(), date: c.date.trim(), url: c.url.trim() }));
    case "languages":
      return resume.languages
        .filter((l) => l.name.trim())
        .map((l) => entry({ id: l.id, title: l.name.trim(), sub: l.level.trim() }));
    case "awards":
      return resume.awards
        .filter((a) => a.title.trim())
        .map((a) =>
          entry({ id: a.id, title: a.title.trim(), sub: a.issuer.trim(), date: a.date.trim(), lines: a.detail.trim() ? [a.detail.trim()] : [] }),
        );
  }
}

/**
 * The portfolio as the page draws it: a list component whose list has
 * nothing to show is left out, so a section is a band only when it has
 * something for one. Applied where the page is rendered — never in the
 * editor, which keeps an empty component so it can be filled. Idempotent.
 */
export function withPlacedLists(p: Portfolio): Portfolio {
  const empty = (s: Section) => s.blocks.some((b) => isListBlock(b) && listEntries(p.resume, b.type).length === 0);
  if (!p.sections.some(empty)) return p;
  return {
    ...p,
    sections: p.sections.map((s) =>
      empty(s) ? { ...s, blocks: s.blocks.filter((b) => !isListBlock(b) || listEntries(p.resume, b.type).length > 0) } : s,
    ),
  };
}

export function resumeFileName(p: Portfolio): string {
  const who = p.header.name.trim() || p.name.trim() || "Resume";
  return `${who} — Resume`;
}

export function resumePrintPath(id: string, auto = true): string {
  return `/resume/${id}${auto ? "?print=1" : ""}`;
}
