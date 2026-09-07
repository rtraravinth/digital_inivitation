"use client";

import Link from "next/link";
import { createContext, useContext, useState } from "react";
import type { CSSProperties } from "react";
import { recordClick } from "@/lib/analytics";
import { LinkIcon, iconFor } from "@/lib/icons";
import type { PublishedPrivacy } from "@/lib/published";
import {
  DEFAULT_TRACKING,
  FONTS,
  TYPE_SCALES,
  type Asset,
  type Density,
  type GridCols,
  type Ground,
  type Portfolio,
  type Section,
  assetSrc,
  pageAddress,
  pagePath,
  previewPath,
} from "@/lib/types";

export const HATCH =
  "repeating-linear-gradient(45deg,#d7d3d3 0 6px,#eae9e9 6px 12px)";

/** Ground swaps the page's ink and paper; the accent is chosen separately. */
const GROUNDS: Record<Ground, Record<string, string>> = {
  light: {
    "--color-bg": "#f3f2f2",
    "--color-surface": "#eae9e9",
    "--color-ink": "#201e1d",
    "--color-divider": "#201e1d66",
    "--color-neutral-700": "#605d5d",
    "--color-neutral-800": "#444141",
  },
  dark: {
    "--color-bg": "#201e1d",
    "--color-surface": "#2d2b2b",
    "--color-ink": "#f3f2f2",
    "--color-divider": "#f3f2f266",
    "--color-neutral-700": "#bab6b6",
    "--color-neutral-800": "#d7d3d3",
  },
  paper: {
    "--color-bg": "#efe9dd",
    "--color-surface": "#e5dece",
    "--color-ink": "#201e1d",
    "--color-divider": "#201e1d66",
    "--color-neutral-700": "#6b6154",
    "--color-neutral-800": "#4a4238",
  },
};

/* ── a picked ground ──────────────────────────────────────────────────── */

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amount) as Rgb;
}

/** WCAG relative luminance, which is what decides whether ink goes light. */
function luminance([r, g, b]: Rgb): number {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast between two luminances, which is the usual (L+0.05) ratio. */
function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const INK_DARK: Rgb = [0x20, 0x1e, 0x1d];
const INK_LIGHT: Rgb = [0xf3, 0xf2, 0xf2];

/**
 * The rest of the palette, worked out from one picked colour.
 *
 * A preset supplies six variables and these have to supply the same six from
 * the one the picker produces. The 6% surface shift is calibrated against the
 * presets rather than guessed: it turns the dark preset's #201e1d into
 * #2d2b2a, one point off its hand-tuned #2d2b2b. The presets keep their own
 * maps regardless — this runs only for a picked colour.
 */
export function derivedGround(hex: string): Record<string, string> {
  const bg = parseHex(hex);
  // Whichever ink reads better against this paper, rather than a luminance
  // threshold. A threshold has to be guessed and gets mid-tones wrong: at
  // #808080 the ink that looks "obviously" right scores 3.53 where the other
  // scores 4.22. Comparing the two contrasts needs no guess.
  const l = luminance(bg);
  const ink =
    contrast(l, luminance(INK_DARK)) >= contrast(l, luminance(INK_LIGHT))
      ? INK_DARK
      : INK_LIGHT;
  return {
    "--color-bg": hex,
    "--color-surface": toHex(mix(bg, ink, 0.06)),
    "--color-ink": toHex(ink),
    // The presets write divider as ink at 40%, which is the `…66` suffix.
    "--color-divider": `${toHex(ink)}66`,
    "--color-neutral-700": toHex(mix(ink, bg, 0.35)),
    "--color-neutral-800": toHex(mix(ink, bg, 0.2)),
  };
}

/** A picked ground wins over the preset; an empty one leaves the preset alone. */
function palette(p: Portfolio): Record<string, string> {
  return p.groundHex ? derivedGround(p.groundHex) : GROUNDS[p.ground];
}

/** Overriding the system's own variables lets every .btn/.tag follow along. */
export function groundStyle(p: Portfolio): CSSProperties {
  const face = FONTS.find((x) => x.id === p.font) ?? FONTS[0];
  const body = FONTS.find((x) => x.id === p.bodyFont) ?? FONTS[0];
  const scale = TYPE_SCALES.find((s) => s.id === p.layout.scale) ?? TYPE_SCALES[1];
  return {
    ...palette(p),
    "--color-accent": p.accent,
    "--font-heading": `var(${face.cssVar}), system-ui, sans-serif`,
    // Both, because `--font-sans` is what Tailwind's `font-sans` utility
    // resolves to; leaving it on Archivo would split the page between two
    // faces depending on whether an element names one.
    "--font-body": `var(${body.cssVar}), system-ui, sans-serif`,
    "--font-sans": `var(${body.cssVar}), system-ui, sans-serif`,
    fontFamily: "var(--font-body)",
    // Read by globals.css's heading rule and by headline() below.
    "--tracking": p.layout.tracking || DEFAULT_TRACKING,
    "--type-scale": String(scale.factor),
    background: "var(--color-bg)",
    color: "var(--color-ink)",
  } as CSSProperties;
}

/**
 * A theme's own display size, multiplied by the headline scale. Inline so it
 * beats the Tailwind arbitrary font-size utility it replaces.
 */
export function headline(size: string): CSSProperties {
  return { fontSize: `calc(${size} * var(--type-scale, 1))` };
}

/**
 * The page's tabs: every distinct tab its visible sections file under, in
 * the order the sections are in.
 *
 * Not capped. A tab is the only route to the sections under it, so dropping
 * one past a limit would take those sections off the page.
 */
export function tabs(p: Portfolio): string[] {
  const seen: string[] = [];
  for (const s of p.sections) {
    if (s.hidden) continue;
    const tab = s.tab.trim();
    if (tab && !seen.includes(tab)) seen.push(tab);
  }
  return seen;
}

/**
 * The page grouped into chapters: each tab with the visible sections filed
 * under it, in section order, with an empty tab dropped.
 *
 * Three callers want exactly this — the "scroll" navigation below, Résumé and
 * Site — so it is computed once here rather than retyped in each of them.
 */
export function chaptersOf(p: Portfolio): Array<{ tab: string; sections: Section[] }> {
  const all = visibleSections(p);
  return tabs(p)
    .map((tab) => ({ tab, sections: all.filter((s) => s.tab === tab) }))
    .filter((c) => c.sections.length > 0);
}

/** The page's own extras: one row of numbers, one timeline, from the header. */
export function allNumbers(p: Portfolio) {
  return p.header.numbers.filter((n) => n.value.trim());
}

export function allDates(p: Portfolio) {
  return p.header.dates
    .filter((d) => d.year.trim())
    .sort((a, b) => a.year.localeCompare(b.year));
}

/** A rule between cells on the accent field: the page's own paper, thinned. */
const RULE_ON_ACCENT = "1px solid color-mix(in srgb, var(--color-bg) 25%, transparent)";

/**
 * The numbers row.
 *
 * `big` sets the figures at display size. `onAccent` paints the whole row on
 * the accent field, where — as on Editorial's band and Poster's hero — every
 * colour is drawn from `--color-bg` rather than a hardcoded white, so a dark
 * ground puts its own ink on the accent instead of diverging from every other
 * theme in the product.
 */
export function StatRow({
  p,
  big,
  onAccent,
}: {
  p: Portfolio;
  big?: boolean;
  onAccent?: boolean;
}) {
  const nums = allNumbers(p);
  if (nums.length === 0) return null;
  const background = onAccent ? "var(--color-accent)" : "var(--color-bg)";
  const rule = onAccent ? RULE_ON_ACCENT : "1px solid var(--color-divider)";
  return (
    // Cell borders rather than gap-bleed: a partly-filled last row would
    // otherwise show the divider ground as empty grey blocks.
    <div
      className="grid grid-cols-2 md:grid-cols-4"
      style={{
        background,
        borderTop: onAccent ? "none" : "2px solid var(--color-divider)",
      }}
    >
      {nums.slice(0, 8).map((n) => (
        <div
          key={n.id}
          className={onAccent ? "px-6 py-8" : "px-5 py-6"}
          style={{ background, borderRight: rule, borderBottom: rule }}
        >
          <div
            className="font-heading font-extrabold leading-none"
            style={{
              fontSize: big ? 40 : 32,
              color: onAccent
                ? "var(--color-bg)"
                : big
                  ? "var(--color-accent)"
                  : "inherit",
            }}
          >
            {n.value}
          </div>
          <div
            className="mt-1 text-xs"
            style={{
              color: onAccent
                ? "color-mix(in srgb, var(--color-bg) 80%, transparent)"
                : "var(--color-neutral-700)",
            }}
          >
            {n.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── layout ───────────────────────────────────────────────────────────── */

/** Hidden sections stay in the document and never reach the published page. */
export function visibleSections(p: Portfolio): Section[] {
  return p.sections.filter((s) => !s.hidden);
}

/** Density is a padding scale; it changes how much fits on a screen. */
const DENSITY_PAD: Record<Density, { card: string; page: string; row: string }> = {
  airy: { card: "p-8", page: "px-8 py-10 md:px-12", row: "py-5" },
  standard: { card: "p-6", page: "px-6 py-8 md:px-10", row: "py-3.5" },
  dense: { card: "p-4", page: "px-4 py-5 md:px-6", row: "py-2" },
};

export function pad(p: Portfolio) {
  return DENSITY_PAD[p.layout.density];
}

const GRID_COLS: Record<GridCols, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
};

export function gridCols(p: Portfolio) {
  return GRID_COLS[p.layout.grid];
}

/**
 * Tab navigation, in the four shapes the Layout panel offers.
 *
 * "scroll" drops the filter and groups the page into chapters instead;
 * "lens" makes the visitor choose a tab before anything else is shown.
 * Poster carries its own navigation by definition — it is the reason you
 * would pick it — so it ignores this.
 *
 * There is no "everything" state. Every section files under exactly one tab,
 * so one tab is always open — the first, until the visitor picks another.
 */
export function useTabFilter(p: Portfolio) {
  const options = tabs(p);
  const [picked, setPicked] = useState<string | null>(null);
  // Separate from `picked`, because a lens page has to know the question was
  // answered even when the answer is the tab it would have opened anyway.
  const [answered, setAnswered] = useState(false);
  const nav = p.layout.roleNav;
  const all = visibleSections(p);

  // A tab the page no longer has — the last section under it was deleted or
  // hidden — falls back rather than showing an empty page.
  const tab = picked && options.includes(picked) ? picked : (options[0] ?? "");
  const shown = tab ? all.filter((s) => s.tab === tab) : all;

  const setTab = (next: string) => {
    setPicked(next);
    setAnswered(true);
  };

  const chapters = nav === "scroll" ? chaptersOf(p) : [];

  return {
    tab,
    setTab,
    shown,
    nav,
    chapters,
    /** True until a "lens" page's opening question has been answered. */
    gated: nav === "lens" && !answered && options.length > 0,
  };
}

/** The opening screen of a "visitor picks a lens first" page. */
export function LensGate({
  p,
  setTab,
  padClass,
}: {
  p: Portfolio;
  setTab: (t: string) => void;
  /** A theme that does not read the density control passes its own padding. */
  padClass?: string;
}) {
  const options = tabs(p);
  return (
    <div className={`mx-auto max-w-[760px] ${padClass ?? pad(p).page}`}>
      <h1 className="m-0 mb-3 leading-[1.05]" style={headline("40px")}>{p.header.name}</h1>
      <p className="mb-8 max-w-[46ch] text-lg" style={{ color: "var(--color-neutral-800)" }}>
        {p.header.description}
      </p>
      <h6 className="mb-3.5">What brings you here?</h6>
      <div className="grid gap-0.5 sm:grid-cols-2" style={{ background: "var(--color-divider)" }}>
        {options.map((t) => {
          const count = visibleSections(p).filter((s) => s.tab === t).length;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex cursor-pointer flex-col items-start gap-1 p-5 text-left"
              style={{ background: "var(--color-bg)" }}
            >
              <span className="font-heading text-lg font-extrabold">{t}</span>
              <span className="text-[12px]" style={{ color: "var(--color-neutral-700)" }}>
                {count} {count === 1 ? "entry" : "entries"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Tabs({
  p,
  tab,
  setTab,
  variant,
}: {
  p: Portfolio;
  tab: string;
  setTab: (t: string) => void;
  /**
   * "underline" rules a scrolling flex row; "block" is Poster's solid tab on
   * the accent field; "segment" is the same underline in a segmented control,
   * where the cells are grid tracks rather than flex items.
   */
  variant: "underline" | "block" | "segment";
}) {
  return (
    <>
      {tabs(p).map((t) => {
        const on = t === tab;
        if (variant === "block") {
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="font-heading flex-none cursor-pointer whitespace-nowrap px-4 py-2.5 text-[13px] font-extrabold"
              style={{
                background: on ? "var(--color-bg)" : "transparent",
                color: on ? "var(--color-ink)" : "inherit",
                opacity: on ? 1 : 0.75,
              }}
            >
              {t}
            </button>
          );
        }
        return (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`font-heading cursor-pointer py-3.5 text-sm font-extrabold ${
              variant === "segment"
                ? // A grid item's automatic minimum size is its content size,
                  // so five tab labels would overrun their 1fr tracks, overlap
                  // and push the page wider than the viewport. `min-w-0` plus
                  // `overflow-hidden` drops that minimum to zero (CSS Grid
                  // §6.6) and lets the label clip with an ellipsis inside its
                  // own column. Owned here rather than patched on from the
                  // parent, so the caller only picks a variant.
                  "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                : // flex-none + nowrap: the row scrolls sideways inside its own
                  // overflow container rather than breaking a tab name in half.
                  "flex-none whitespace-nowrap"
            }`}
            style={{
              color: on ? "var(--color-accent)" : "var(--color-neutral-700)",
              boxShadow: on ? "inset 0 -3px 0 var(--color-accent)" : "none",
            }}
          >
            {t}
          </button>
        );
      })}
    </>
  );
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-3.5 text-[11px] uppercase tracking-[0.1em]"
      style={{ color: "var(--color-accent)" }}
    >
      {children}
    </div>
  );
}

/** Seed URLs are written bare ("northwell.in"), so fill in a scheme. */
export function href(url: string) {
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return trimmed;
  if (trimmed.includes("@") && !trimmed.includes("/")) return `mailto:${trimmed}`;
  let path = trimmed;
  while (path.startsWith("/")) path = path.slice(1);
  return `https://${path}`;
}

export function SectionLinks({ p, section }: { p: Portfolio; section: Section }) {
  const handle = usePublishedHandle();
  const record = useRecordClick();
  if (section.links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
      {section.links.map((l) => (
        <a
          key={l.id}
          href={href(l.url)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => record(handle, p.slug, section.id)}
          className="inline-flex items-center gap-1.5"
          style={{ color: "var(--color-accent)" }}
        >
          <LinkIcon id={iconFor(l)} />
          {l.label || l.url} ↗
        </a>
      ))}
    </div>
  );
}

/** A stored image, or the hatched placeholder when there is none. */
export function Media({
  asset,
  className,
  caption,
}: {
  asset: Asset | null;
  className: string;
  caption?: string;
}) {
  if (asset) {
    // A data URI out of localStorage — nothing for next/image to optimise.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={assetSrc(asset)}
        alt={asset.name}
        className={`grayscale-photo object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`grayscale-photo flex items-end p-2.5 ${className}`}
      style={{ background: HATCH }}
    >
      {caption && <span className="text-[10px] text-neutral-700">{caption}</span>}
    </div>
  );
}

/** The pull quote and the downloadable attachment, when a section has them. */
export function SectionAside({ p, section }: { p: Portfolio; section: Section }) {
  const handle = usePublishedHandle();
  const record = useRecordClick();
  return (
    <>
      {section.quote?.text && (
        <blockquote
          className="m-0 py-1 pl-3.5 text-[15px] italic"
          style={{ borderLeft: "3px solid var(--color-accent)" }}
        >
          “{section.quote.text}”
          {section.quote.attribution && (
            <footer
              className="mt-1 text-[12px] not-italic"
              style={{ color: "var(--color-neutral-700)" }}
            >
              — {section.quote.attribution}
            </footer>
          )}
        </blockquote>
      )}
      {section.file && (
        <a
          href={assetSrc(section.file)}
          download={section.file.name}
          onClick={() => record(handle, p.slug, section.id)}
          className="btn btn-secondary self-start"
          style={{ fontSize: 12, padding: "4px 10px" }}
        >
          ↓ {section.file.name}
        </a>
      )}
    </>
  );
}

/**
 * The owner's privacy switches, handed down from the server response.
 *
 * This used to read the *visitor's* own account, which meant a signed-out
 * visitor saw the defaults and a signed-in one had their own settings applied
 * to somebody else's page. The server decides now, and passes the answer in.
 */
const PrivacyContext = createContext<PublishedPrivacy>({
  noindex: false,
  badge: true,
  showContact: true,
});

export function PrivacyProvider({
  value,
  children,
}: {
  value: PublishedPrivacy;
  children: React.ReactNode;
}) {
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePublishedPrivacy() {
  return useContext(PrivacyContext);
}

/**
 * The owner's handle, from the address that served this page.
 *
 * Click recording posts to /public/p/<handle>/<slug>/clicks, and a slug alone
 * no longer identifies a page — two accounts can both have "investors".
 */
const HandleContext = createContext<string>("");

export function PublishedHandleProvider({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return <HandleContext.Provider value={value}>{children}</HandleContext.Provider>;
}

export function usePublishedHandle() {
  return useContext(HandleContext);
}

/**
 * True while the owner is looking at their own page from inside the app.
 *
 * Analytics are counted from real visitors, so a preview must not add to
 * them: click recording goes through `useRecordClick`, which is a no-op here.
 */
const PreviewContext = createContext(false);

export function PreviewProvider({
  value,
  children,
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

function noRecord() {}

export function useRecordClick() {
  return useContext(PreviewContext) ? noRecord : recordClick;
}

export function useIsPreview() {
  return useContext(PreviewContext);
}

/**
 * Where this page lives, from inside it.
 *
 * A preview is served from `/preview/<id>`, and the public address does not
 * resolve at all until the portfolio is published — the API answers 404 for
 * a draft on purpose. A section link that always pointed at
 * `/p/<handle>/<slug>` was therefore a dead end for exactly the drafts the
 * preview exists to show.
 */
export function usePageHref(p: Portfolio): string {
  const handle = usePublishedHandle();
  return useIsPreview() ? previewPath(p.id) : pagePath(handle, p.slug);
}



/** The header's links, unless the owner has hidden them from strangers. */
export function HeaderLinks({
  p,
  block,
  inline,
}: {
  p: Portfolio;
  block?: boolean;
  inline?: boolean;
}) {
  const privacy = usePublishedPrivacy();
  if (!privacy.showContact) {
    return (
      <p className="m-0 text-[12px]" style={{ color: "var(--color-neutral-700)" }}>
        Contact details are hidden. Ask {p.header.name.split(" ")[0] || "the owner"} for
        them directly.
      </p>
    );
  }
  if (inline) {
    return (
      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        {p.header.links.map((l, i) => (
          <span key={l.id} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" style={{ color: "var(--color-neutral-700)" }}>·</span>}
            <a
              href={href(l.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5"
              style={{ color: "var(--color-accent)" }}
            >
              <LinkIcon id={iconFor(l)} />
              {l.label || l.url}
            </a>
          </span>
        ))}
      </p>
    );
  }
  return (
    <div className={block ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
      {p.header.links.map((l) => (
        <a
          key={l.id}
          href={href(l.url)}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn btn-secondary ${block ? "btn-block" : ""}`}
        >
          <LinkIcon id={iconFor(l)} />
          {l.label}
        </a>
      ))}
    </div>
  );
}

/**
 * "Save contact" — a real vCard built from the header, so a phone that opens
 * it files the page's owner in the address book. No server, no library: the
 * card is assembled here and handed over as a blob.
 */
export function saveContact(p: Portfolio, handle: string) {
  const esc = (v: string) => v.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const emails = p.header.links.filter((l) => l.url.includes("@") && !l.url.includes("/"));
  const urls = p.header.links.filter((l) => !emails.includes(l));

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(p.header.name)}`,
    p.header.current && `TITLE:${esc(p.header.current)}`,
    p.header.description && `NOTE:${esc(p.header.description)}`,
    ...emails.map((l) => `EMAIL;TYPE=INTERNET:${esc(l.url.trim())}`),
    ...urls.map((l) => `URL:${esc(href(l.url))}`),
    `URL:https://${esc(pageAddress(handle, p.slug))}`,
    "END:VCARD",
  ].filter(Boolean);

  const blob = new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${p.header.name.trim().replace(/\s+/g, "-").toLowerCase() || p.slug}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}

/** A section's title, linking through to its own page — artboard 1d. */
export function SectionTitleLink({
  p,
  section,
  className,
}: {
  p: Portfolio;
  section: Section;
  className: string;
}) {
  const pageHref = usePageHref(p);
  return (
    <Link
      href={`${pageHref}?section=${section.id}`}
      className={className}
      style={{ color: "inherit", textDecoration: "none" }}
    >
      {section.title}
    </Link>
  );
}
