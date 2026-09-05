"use client";

import Link from "next/link";
import { createContext, useContext, useState } from "react";
import type { CSSProperties } from "react";
import { recordClick } from "@/lib/analytics";
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
} from "@/lib/types";

const HATCH =
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

/** Overriding the system's own variables lets every .btn/.tag follow along. */
export function groundStyle(p: Portfolio): CSSProperties {
  const face = FONTS.find((x) => x.id === p.font) ?? FONTS[0];
  const scale = TYPE_SCALES.find((s) => s.id === p.layout.scale) ?? TYPE_SCALES[1];
  return {
    ...GROUNDS[p.ground],
    "--color-accent": p.accent,
    "--font-heading": `var(${face.cssVar}), system-ui, sans-serif`,
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

/** The page's own extras: one row of numbers, one timeline, from the header. */
function allNumbers(p: Portfolio) {
  return p.header.numbers.filter((n) => n.value.trim());
}

function allDates(p: Portfolio) {
  return p.header.dates
    .filter((d) => d.year.trim())
    .sort((a, b) => a.year.localeCompare(b.year));
}

function StatRow({ p, big }: { p: Portfolio; big?: boolean }) {
  const nums = allNumbers(p);
  if (nums.length === 0) return null;
  return (
    // Cell borders rather than gap-bleed: a partly-filled last row would
    // otherwise show the divider ground as empty grey blocks.
    <div
      className="grid grid-cols-2 md:grid-cols-4"
      style={{
        background: "var(--color-bg)",
        borderTop: "2px solid var(--color-divider)",
      }}
    >
      {nums.slice(0, 8).map((n) => (
        <div
          key={n.id}
          className="px-5 py-6"
          style={{
            background: "var(--color-bg)",
            borderRight: "1px solid var(--color-divider)",
            borderBottom: "1px solid var(--color-divider)",
          }}
        >
          <div
            className="font-heading font-extrabold leading-none"
            style={{
              fontSize: big ? 40 : 32,
              color: big ? "var(--color-accent)" : "inherit",
            }}
          >
            {n.value}
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--color-neutral-700)" }}>
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
 * Index rail, Poster and Dossier carry their own navigation by definition —
 * it is the reason you would pick them — so they ignore this.
 *
 * There is no "everything" state. Every section files under exactly one tab,
 * so one tab is always open — the first, until the visitor picks another.
 */
function useTabFilter(p: Portfolio) {
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

  const chapters =
    nav === "scroll"
      ? options
          .map((t) => ({ tab: t, sections: all.filter((s) => s.tab === t) }))
          .filter((c) => c.sections.length > 0)
      : [];

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
function LensGate({
  p,
  setTab,
}: {
  p: Portfolio;
  setTab: (t: string) => void;
}) {
  const options = tabs(p);
  return (
    <div className={`mx-auto max-w-[760px] ${pad(p).page}`}>
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

function Tabs({
  p,
  tab,
  setTab,
  variant,
}: {
  p: Portfolio;
  tab: string;
  setTab: (t: string) => void;
  variant: "underline" | "block";
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
            // flex-none + nowrap: the row scrolls sideways inside its own
            // overflow container rather than breaking a tab name in half.
            className="font-heading flex-none cursor-pointer whitespace-nowrap py-3.5 text-sm font-extrabold"
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

function Kicker({ children }: { children: React.ReactNode }) {
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
function href(url: string) {
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return trimmed;
  if (trimmed.includes("@") && !trimmed.includes("/")) return `mailto:${trimmed}`;
  let path = trimmed;
  while (path.startsWith("/")) path = path.slice(1);
  return `https://${path}`;
}

function SectionLinks({ p, section }: { p: Portfolio; section: Section }) {
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
          style={{ color: "var(--color-accent)" }}
        >
          {l.label || l.url} ↗
        </a>
      ))}
    </div>
  );
}

/** A stored image, or the hatched placeholder when there is none. */
function Media({
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
function SectionAside({ p, section }: { p: Portfolio; section: Section }) {
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

function useRecordClick() {
  return useContext(PreviewContext) ? noRecord : recordClick;
}



/** The header's links, unless the owner has hidden them from strangers. */
function HeaderLinks({ p, block }: { p: Portfolio; block?: boolean }) {
  const privacy = usePublishedPrivacy();
  if (!privacy.showContact) {
    return (
      <p className="m-0 text-[12px]" style={{ color: "var(--color-neutral-700)" }}>
        Contact details are hidden. Ask {p.header.name.split(" ")[0] || "the owner"} for
        them directly.
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
function saveContact(p: Portfolio, handle: string) {
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
function SectionTitleLink({
  p,
  section,
  className,
}: {
  p: Portfolio;
  section: Section;
  className: string;
}) {
  const handle = usePublishedHandle();
  return (
    <Link
      href={`${pagePath(handle, p.slug)}?section=${section.id}`}
      className={className}
      style={{ color: "inherit", textDecoration: "none" }}
    >
      {section.title}
    </Link>
  );
}

/* ── 1a Editorial — tabs across a modular grid ────────────────────────── */

/** One card in the Editorial / Poster / Broadsheet grids. */
function SectionCard({ p, section }: { p: Portfolio; section: Section }) {
  return (
    <div
      className={`flex flex-col gap-2.5 ${pad(p).card}`}
      style={{
        background: "var(--color-bg)",
        borderRight: "1px solid var(--color-divider)",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      {section.image && <Media asset={section.image} className="mb-1 h-[150px] w-full" />}
      <span className="card-kicker">{section.tab}</span>
      <SectionTitleLink
        p={p}
        section={section}
        className="font-heading text-[21px] font-extrabold leading-tight hover:underline"
      />
      <p className="m-0 flex-1 text-sm opacity-80">{section.description}</p>
      <SectionAside p={p} section={section} />
      <SectionLinks p={p} section={section} />
    </div>
  );
}

export function Editorial({ p }: { p: Portfolio }) {
  const handle = usePublishedHandle();
  const { tab, setTab, shown, nav, chapters, gated } = useTabFilter(p);
  const cta = p.header.links[0];
  const numbers = allNumbers(p);
  const dates = allDates(p);
  const railTabs = tabs(p);
  const showContact = usePublishedPrivacy().showContact;

  if (gated) {
    return (
      <div style={groundStyle(p)}>
        <LensGate p={p} setTab={setTab} />
      </div>
    );
  }

  const cards = (
    <div
      className={`grid ${gridCols(p)}`}
      style={{ borderRight: "1px solid var(--color-divider)" }}
    >
      {shown.map((s) => (
        <SectionCard key={s.id} p={p} section={s} />
      ))}
    </div>
  );

  return (
    <div style={groundStyle(p)}>

      <div className="grid gap-12 px-6 pb-8 pt-10 md:grid-cols-[1fr_380px] md:px-10">
        <div>
          {p.header.current && <Kicker>{p.header.current}</Kicker>}
          <h1 className="m-0 mb-4 leading-[1.02]" style={headline("clamp(40px, 6vw, 64px)")}>
            {p.header.name}
          </h1>
          <p className="m-0 mb-5 max-w-[44ch] text-lg">{p.header.description}</p>
          <div className="flex flex-wrap gap-2">
            {p.header.tags.map((t, i) => (
              <span key={t} className={`tag ${i === 0 ? "tag-accent" : "tag-neutral"}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
        {/* 1d puts the portrait at 96px square on a phone. */}
        <div
          className="h-24 w-24 md:h-[260px] md:w-auto"
        >
          <Media
            asset={p.header.portrait}
            className="h-full w-full"
            caption="portrait — 3:4, b&amp;w"
          />
        </div>
      </div>

      {nav === "tabs" && (
        <div
          className="flex gap-7 overflow-x-auto px-6 md:px-10"
          style={{ borderBottom: "2px solid var(--color-divider)" }}
        >
          <Tabs p={p} tab={tab} setTab={setTab} variant="underline" />
        </div>
      )}

      {nav === "lens" && (
        <div
          className="flex flex-wrap items-center gap-3 px-6 py-3 md:px-10"
          style={{ borderBottom: "2px solid var(--color-divider)" }}
        >
          <span className="text-[12px]" style={{ color: "var(--color-neutral-700)" }}>
            Showing
          </span>
          <span className="tag tag-accent">{tab}</span>
        </div>
      )}

      {/* Cards beside "By the numbers" — unless a rail is taking the left. */}
      <div
        className={`grid ${
          nav === "rail"
            ? "lg:grid-cols-[220px_1fr]"
            : numbers.length > 0
              ? "lg:grid-cols-[1fr_340px]"
              : ""
        }`}
        style={{ borderBottom: "2px solid var(--color-divider)" }}
      >
        {nav === "rail" && (
          <div
            className="p-4"
            style={{
              background: "var(--color-surface)",
              borderRight: "2px solid var(--color-divider)",
            }}
          >
            {railTabs.map((t, i) => {
              const on = t === tab;
              const count = visibleSections(p).filter((s) => s.tab === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="flex w-full cursor-pointer items-center gap-3 py-2.5 text-left text-sm"
                  style={{
                    borderBottom: "1px solid var(--color-divider)",
                    color: on ? "var(--color-accent)" : "inherit",
                    fontWeight: on ? 800 : 400,
                  }}
                >
                  <span className="font-heading text-[11px] font-extrabold opacity-55">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{t}</span>
                  <span className="ml-auto text-[11px] opacity-55">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {nav === "scroll" ? (
          <div>
            {chapters.map((c) => (
              <div key={c.tab}>
                <div
                  className="px-6 py-3 md:px-10"
                  style={{
                    background: "var(--color-surface)",
                    borderBottom: "1px solid var(--color-divider)",
                  }}
                >
                  <h6 className="m-0">{c.tab}</h6>
                </div>
                <div className={`grid ${gridCols(p)}`}>
                  {c.sections.map((s) => (
                    <SectionCard key={s.id} p={p} section={s} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          cards
        )}

        {numbers.length > 0 && nav !== "rail" && (
          <div className="p-6">
            <h6 className="mb-3.5">By the numbers</h6>
            {numbers.map((n) => (
              <div
                key={n.id}
                className="py-3"
                style={{ borderBottom: "1px solid var(--color-divider)" }}
              >
                <div className="font-heading text-[30px] font-extrabold leading-none">
                  {n.value}
                </div>
                <div className="text-xs" style={{ color: "var(--color-neutral-700)" }}>
                  {n.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The rail takes the column the numbers panel would have used. */}
      {numbers.length > 0 && nav === "rail" && <StatRow p={p} />}

      {dates.length > 0 && (
        <div className="px-6 py-8 md:px-10">
          <h6 className="mb-4">Timeline</h6>
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
            style={{ borderTop: "2px solid var(--color-divider)" }}
          >
            {dates.map((e) => (
              <div
                key={e.id}
                className="px-3.5 pb-5 pt-4"
                style={{
                  background: "var(--color-bg)",
                  borderRight: "1px solid var(--color-divider)",
                }}
              >
                <div
                  className="font-heading mb-1.5 text-base font-extrabold"
                  style={{ color: "var(--color-accent)" }}
                >
                  {e.year}
                </div>
                <div className="text-[13px] leading-snug">{e.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="flex flex-col items-start gap-6 px-6 py-7 md:flex-row md:items-center md:px-10"
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      >
        <div className="font-heading max-w-[22ch] text-[26px] font-extrabold leading-[1.15]">
          Working on something that needs a steady hand on the numbers?
        </div>
        {cta && showContact && (
          <a
            href={href(cta.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn md:ml-auto"
            style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}
          >
            {cta.label}
          </a>
        )}
        <span
          className={`btn ${cta && showContact ? "" : "md:ml-auto"}`}
          style={{ borderColor: "var(--color-bg)", color: "var(--color-bg)" }}
        >
          {pageAddress(handle, p.slug)}
        </span>
      </div>
    </div>
  );
}

/* ── 1b Index rail — tabs as a numbered sidebar, records as a table ──── */

export function IndexRail({ p }: { p: Portfolio }) {
  const { tab, setTab, shown } = useTabFilter(p);
  const all = tabs(p);

  return (
    <div style={groundStyle(p)}>

      <div className="grid md:grid-cols-[300px_1fr]">
        <div
          className="p-6 md:p-8"
          style={{
            background: "var(--color-surface)",
            borderRight: "2px solid var(--color-divider)",
          }}
        >
          <div
            className="mb-4 h-[120px] w-[120px]"
          >
            <Media asset={p.header.portrait} className="h-full w-full" />
          </div>
          <h2 className="mb-1.5" style={headline("30px")}>{p.header.name}</h2>
          <p className="mb-5 text-[13px]" style={{ color: "var(--color-neutral-700)" }}>
            {p.header.current}
          </p>

          <div style={{ borderTop: "2px solid var(--color-divider)" }}>
            {all.map((t, i) => {
              const on = t === tab;
              const count = visibleSections(p).filter((s) => s.tab === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="flex w-full cursor-pointer items-center gap-3 py-2.5 text-left text-sm"
                  style={{
                    borderBottom: "1px solid var(--color-divider)",
                    color: on ? "var(--color-accent)" : "inherit",
                    fontWeight: on ? 800 : 400,
                  }}
                >
                  <span className="font-heading text-[11px] font-extrabold opacity-55">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{t}</span>
                  <span className="ml-auto text-[11px] opacity-55">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <HeaderLinks p={p} block />
          </div>
        </div>

        <div>
          <div
            className="px-6 pb-6 pt-8 md:px-9"
            style={{ borderBottom: "2px solid var(--color-divider)" }}
          >
            <Kicker>{tab}</Kicker>
            <p className="m-0 max-w-[60ch] text-[19px]">{p.header.description}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>#</th>
                  <th>Work</th>
                  <th style={{ width: 150 }}>Tab</th>
                  <th style={{ width: 210 }}>Links</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s, i) => (
                  <tr key={s.id}>
                    <td className="font-extrabold">{String(i + 1).padStart(2, "0")}</td>
                    <td>
                      <SectionTitleLink
                        p={p}
                        section={s}
                        className="block font-extrabold hover:underline"
                      />
                      <div
                        className="text-xs"
                        style={{ color: "var(--color-neutral-700)" }}
                      >
                        {s.description}
                      </div>
                    </td>
                    <td>
                      <span className="tag tag-neutral">{s.tab}</span>
                    </td>
                    <td className="text-[13px]">
                      {s.links.map((l) => l.label).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <StatRow p={p} />
        </div>
      </div>
    </div>
  );
}

/* ── 1c Poster — accent field hero, tabs as a statement ───────────────── */

export function Poster({ p }: { p: Portfolio }) {
  const { tab, setTab, shown } = useTabFilter(p);
  const dates = allDates(p);

  return (
    <div style={groundStyle(p)}>
      <div
        className="px-6 pt-8 md:px-11 md:pt-11"
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      >

        <h1 className="m-0 mb-5 leading-[0.92] tracking-[-0.03em]" style={headline("clamp(56px, 10vw, 104px)")}>
          {p.header.name.split(" ").map((w, i) => (
            <span key={`${w}-${i}`} className="block">
              {w}
            </span>
          ))}
        </h1>
        <p className="m-0 mb-9 max-w-[34ch] text-[22px]">{p.header.description}</p>

        <div className="flex flex-wrap">
          <Tabs p={p} tab={tab} setTab={setTab} variant="block" />
        </div>
      </div>

      <StatRow p={p} big />

      <div
        className={`grid ${gridCols(p)}`}
        style={{ borderTop: "2px solid var(--color-divider)" }}
      >
        {shown.map((s) => (
          <div
            key={s.id}
            className={`flex flex-col gap-3 ${pad(p).card}`}
            style={{
              background: "var(--color-bg)",
              borderRight: "1px solid var(--color-divider)",
              borderBottom: "1px solid var(--color-divider)",
            }}
          >
            <div className="h-[150px]">
              <Media asset={s.image} className="h-full w-full" caption="image — 16:9" />
            </div>
            <span className="card-kicker">{s.tab}</span>
            <h3 className="m-0">
              <SectionTitleLink p={p} section={s} className="hover:underline" />
            </h3>
            <p className="m-0 text-sm" style={{ color: "var(--color-neutral-800)" }}>
              {s.description}
            </p>
            <SectionAside p={p} section={s} />
            <SectionLinks p={p} section={s} />
          </div>
        ))}
      </div>

      {dates.length > 0 && (
        <div
          className="px-6 py-9 md:px-11"
          style={{ borderTop: "2px solid var(--color-divider)" }}
        >
          <div className="grid gap-8 md:grid-cols-[200px_1fr]">
            <h6 className="m-0">Career</h6>
            <div>
              {dates.map((e) => (
                <div
                  key={e.id}
                  className="flex gap-6 py-3.5"
                  style={{ borderBottom: "1px solid var(--color-divider)" }}
                >
                  <span className="font-heading w-20 flex-none text-xl font-extrabold">
                    {e.year}
                  </span>
                  <span className="text-base">{e.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 3a Links — tabs over a stack of tappable rows ────────────────────── */

export function Links({ p }: { p: Portfolio }) {
  const handle = usePublishedHandle();
  const record = useRecordClick();
  const { tab, setTab, shown, nav, gated } = useTabFilter(p);
  const showContact = usePublishedPrivacy().showContact;
  const cta = p.header.links[0];

  if (gated) {
    return (
      <div style={groundStyle(p)}>
        <LensGate p={p} setTab={setTab} />
      </div>
    );
  }

  return (
    <div style={groundStyle(p)}>

      <div className="mx-auto w-full max-w-[560px]">
        <div
          className="px-[18px] pb-4 pt-6"
          style={{ borderBottom: "2px solid var(--color-divider)" }}
        >
          <div className="flex items-start gap-3.5">
            <div className="h-[72px] w-[72px] flex-none">
              <Media asset={p.header.portrait} className="h-full w-full" />
            </div>
            <div>
              <h2 className="m-0 mb-1" style={headline("24px")}>{p.header.name}</h2>
              <p className="m-0 text-[13px]" style={{ color: "var(--color-neutral-800)" }}>
                {p.header.description}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.header.tags.map((t, i) => (
              <span key={t} className={`tag ${i === 0 ? "tag-accent" : "tag-neutral"}`}>
                {t}
              </span>
            ))}
          </div>
        </div>

        {nav !== "scroll" && (
          <div
            className="flex gap-[18px] overflow-x-auto px-[18px]"
            style={{ borderBottom: "2px solid var(--color-divider)" }}
          >
            <Tabs p={p} tab={tab} setTab={setTab} variant="underline" />
          </div>
        )}

        {shown.map((s, i) => {
          const first = s.links[0];
          const sub = first?.label || s.description || s.tab;
          const inner = (
            <>
              <span
                className="font-heading flex h-[34px] w-[34px] flex-none items-center justify-center text-xs font-extrabold"
                style={{
                  color: "var(--color-accent)",
                  boxShadow: "inset 0 0 0 2px var(--color-divider)",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-heading text-[15px] font-extrabold leading-tight">
                  {s.title}
                </span>
                <span
                  className="truncate text-xs"
                  style={{ color: "var(--color-neutral-700)" }}
                >
                  {sub}
                </span>
              </span>
              <span
                className="font-heading ml-auto pl-2 text-sm font-extrabold"
                style={{ color: "var(--color-neutral-700)" }}
              >
                {first ? "↗" : "›"}
              </span>
            </>
          );
          // 44px minimum hit target — these rows are built for a thumb.
          const rowClass =
            "flex min-h-[56px] items-center gap-3 px-[18px] py-3.5 no-underline";
          const rowStyle = {
            borderBottom: "1px solid var(--color-divider)",
            color: "var(--color-ink)",
          };
          return first ? (
            <a
              key={s.id}
              href={href(first.url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => record(handle, p.slug, s.id)}
              className={rowClass}
              style={rowStyle}
            >
              {inner}
            </a>
          ) : (
            <Link
              key={s.id}
              href={`${pagePath(handle, p.slug)}?section=${s.id}`}
              className={rowClass}
              style={rowStyle}
            >
              {inner}
            </Link>
          );
        })}

        {showContact && (
          <div
            className="flex gap-2 px-[18px] py-4"
            style={{ borderBottom: "2px solid var(--color-divider)" }}
          >
            {cta && (
              <a
                href={href(cta.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary flex-1"
              >
                {cta.label}
              </a>
            )}
            <button
              type="button"
              className={`btn btn-secondary ${cta ? "" : "flex-1"}`}
              onClick={() => saveContact(p, handle)}
            >
              Save contact
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 px-[18px] py-3.5">
          <span className="text-[11px]" style={{ color: "var(--color-neutral-700)" }}>
            {pageAddress(handle, p.slug)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Ledger — everything as one long table ────────────────────────────── */

export function Ledger({ p }: { p: Portfolio }) {
  const { tab, setTab, shown, nav, gated } = useTabFilter(p);
  const dates = allDates(p);

  if (gated) {
    return (
      <div style={groundStyle(p)}>
        <LensGate p={p} setTab={setTab} />
      </div>
    );
  }

  return (
    <div style={groundStyle(p)}>

      <div
        className={pad(p).page}
        style={{ borderBottom: "2px solid var(--color-divider)" }}
      >
        <h1 className="m-0 mb-2 leading-[1.05]" style={headline("34px")}>{p.header.name}</h1>
        <p className="m-0 max-w-[60ch] text-[15px]">{p.header.current}</p>
      </div>

      {nav !== "scroll" && (
        <div
          className="flex gap-7 overflow-x-auto px-6 md:px-10"
          style={{ borderBottom: "2px solid var(--color-divider)" }}
        >
          <Tabs p={p} tab={tab} setTab={setTab} variant="underline" />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>Entry</th>
              <th style={{ width: 150 }}>Tab</th>
              <th style={{ width: 180 }}>Links</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s, i) => (
              <tr key={s.id}>
                <td className="font-extrabold">{String(i + 1).padStart(2, "0")}</td>
                <td>
                  <SectionTitleLink
                    p={p}
                    section={s}
                    className="block font-extrabold hover:underline"
                  />
                  <div className="text-xs" style={{ color: "var(--color-neutral-700)" }}>
                    {s.description}
                  </div>
                </td>
                <td><span className="tag tag-neutral">{s.tab}</span></td>
                <td className="text-[13px]">
                  <SectionLinks p={p} section={s} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StatRow p={p} />

      {dates.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Year</th>
                <th>Event</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((d) => (
                <tr key={d.id}>
                  <td className="font-extrabold" style={{ color: "var(--color-accent)" }}>
                    {d.year}
                  </td>
                  <td>{d.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Dossier — the visitor picks a lens, the page rewrites itself ─────── */

export function Dossier({ p }: { p: Portfolio }) {
  // A lens is the whole point of this theme, so it asks regardless of the
  // Layout panel's navigation setting.
  const [picked, setPicked] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const showContact = usePublishedPrivacy().showContact;
  const all = visibleSections(p);
  const options = tabs(p);
  const lens = picked && options.includes(picked) ? picked : (options[0] ?? "");
  const shown = lens ? all.filter((s) => s.tab === lens) : all;

  if (!answered && options.length > 0) {
    return (
      <div style={groundStyle(p)}>
        <LensGate
          p={p}
          setTab={(t) => {
            setPicked(t);
            setAnswered(true);
          }}
        />
      </div>
    );
  }

  return (
    <div style={groundStyle(p)}>

      <div
        className="flex flex-wrap items-center gap-2 px-6 py-3 md:px-10"
        style={{ background: "var(--color-surface)", borderBottom: "2px solid var(--color-divider)" }}
      >
        <span className="text-[12px]" style={{ color: "var(--color-neutral-700)" }}>
          Reading as
        </span>
        {options.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setPicked(t)}
            className={`tag cursor-pointer ${lens === t ? "tag-accent" : "tag-neutral"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={`mx-auto max-w-[820px] ${pad(p).page}`}>
        <Kicker>{lens || "The whole picture"}</Kicker>
        <h1 className="m-0 mb-4 leading-[1.02]" style={headline("44px")}>{p.header.name}</h1>
        <p className="m-0 mb-6 max-w-[54ch] text-lg">{p.header.description}</p>
        {showContact && <HeaderLinks p={p} />}

        <hr className="hr" />

        {shown.map((s, i) => (
          <article key={s.id} className={DENSITY_PAD[p.layout.density].row}>
            <div className="mb-2 flex items-baseline gap-3">
              <span
                className="font-heading text-[11px] font-extrabold"
                style={{ color: "var(--color-accent)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="m-0">
                <SectionTitleLink p={p} section={s} className="hover:underline" />
              </h3>
            </div>
            {s.image && <Media asset={s.image} className="mb-3 h-[200px] w-full" />}
            <p className="m-0 mb-2 max-w-[62ch] text-[15px]">{s.description}</p>
            <SectionAside p={p} section={s} />
            <SectionLinks p={p} section={s} />
            <hr className="hr" />
          </article>
        ))}

        {shown.length === 0 && (
          <p style={{ color: "var(--color-neutral-700)" }}>
            Nothing filed under {lens}. Try another lens above.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Broadsheet — columns of type with rules between ──────────────────── */

export function Broadsheet({ p }: { p: Portfolio }) {
  const { tab, setTab, shown, nav, gated } = useTabFilter(p);
  const dates = allDates(p);

  if (gated) {
    return (
      <div style={groundStyle(p)}>
        <LensGate p={p} setTab={setTab} />
      </div>
    );
  }

  return (
    <div style={groundStyle(p)}>

      {/* Masthead */}
      <div
        className="px-6 pb-4 pt-8 text-center md:px-10"
        style={{ borderBottom: "4px double var(--color-divider)" }}
      >
        <h1 className="m-0 leading-none tracking-[-0.02em]" style={headline("clamp(44px, 7vw, 68px)")}>
          {p.header.name}
        </h1>
        <p
          className="m-0 mt-2 text-[12px] uppercase tracking-[0.18em]"
          style={{ color: "var(--color-neutral-700)" }}
        >
          {p.header.current}
        </p>
      </div>

      {nav !== "scroll" && (
        <div
          className="flex justify-center gap-7 overflow-x-auto px-6 md:px-10"
          style={{ borderBottom: "2px solid var(--color-divider)" }}
        >
          <Tabs p={p} tab={tab} setTab={setTab} variant="underline" />
        </div>
      )}

      <div className={pad(p).page}>
        <p className="m-0 mb-6 text-[19px] leading-relaxed first-letter:float-left first-letter:mr-2 first-letter:font-extrabold first-letter:text-[56px] first-letter:leading-[0.8]">
          {p.header.description}
        </p>

        {/* Real newspaper columns — the rule between them is a column-rule. */}
        <div
          className="[column-gap:2rem] md:[column-count:2] lg:[column-count:3]"
          style={{ columnRule: "1px solid var(--color-divider)" }}
        >
          {shown.map((s) => (
            <article key={s.id} className="mb-6 break-inside-avoid">
              <span className="card-kicker">{s.tab}</span>
              <h3 className="m-0 mb-1.5 mt-1 text-[19px]">
                <SectionTitleLink p={p} section={s} className="hover:underline" />
              </h3>
              {s.image && <Media asset={s.image} className="mb-2 h-[120px] w-full" />}
              <p className="m-0 mb-2 text-[14px] leading-snug">{s.description}</p>
              {s.quote?.text && (
                <blockquote
                  className="m-0 my-2 py-1 pl-3 text-[14px] italic"
                  style={{ borderLeft: "3px solid var(--color-accent)" }}
                >
                  “{s.quote.text}”
                </blockquote>
              )}
              <SectionLinks p={p} section={s} />
            </article>
          ))}
        </div>
      </div>

      <StatRow p={p} />

      {dates.length > 0 && (
        <div className={pad(p).page} style={{ borderTop: "2px solid var(--color-divider)" }}>
          <h6 className="mb-3.5">In brief</h6>
          <div
            className="[column-gap:2rem] md:[column-count:2] lg:[column-count:3]"
            style={{ columnRule: "1px solid var(--color-divider)" }}
          >
            {dates.map((d) => (
              <div key={d.id} className="mb-2 break-inside-avoid text-[14px]">
                <span
                  className="font-heading mr-2 font-extrabold"
                  style={{ color: "var(--color-accent)" }}
                >
                  {d.year}
                </span>
                {d.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 1d Section detail — one entry on its own page ────────────────────── */

export function SectionDetail({ p, section }: { p: Portfolio; section: Section }) {
  const handle = usePublishedHandle();
  const index = visibleSections(p).findIndex((s) => s.id === section.id);
  const total = visibleSections(p).length;

  return (
    <div style={groundStyle(p)}>
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ borderBottom: "2px solid var(--color-divider)" }}
      >
        <Link href={pagePath(handle, p.slug)} className="btn btn-secondary">
          ← Back
        </Link>
        <span
          className="ml-auto text-[12px]"
          style={{ color: "var(--color-neutral-700)" }}
        >
          {index >= 0 ? `Entry ${index + 1} / ${total}` : p.header.name}
        </span>
      </div>

      <div className="mx-auto w-full max-w-[720px]">
        <Media asset={section.image} className="h-[180px] w-full md:h-[280px]" />

        <div className="px-4 py-5 md:px-6">
          <span className="card-kicker">{section.tab}</span>
          <h1 className="m-0 mb-2.5 mt-2 leading-tight" style={headline("clamp(28px, 5vw, 40px)")}>
            {section.title}
          </h1>
          <p className="m-0 text-[15px]" style={{ color: "var(--color-neutral-800)" }}>
            {section.description}
          </p>
        </div>

        <div className="px-4 py-4 md:px-6">
          <div className="flex flex-col gap-3">
            <SectionAside p={p} section={section} />
            <SectionLinks p={p} section={section} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublishedBody({ p }: { p: Portfolio }) {
  switch (p.theme) {
    case "index":
      return <IndexRail p={p} />;
    case "poster":
      return <Poster p={p} />;
    case "links":
      return <Links p={p} />;
    case "ledger":
      return <Ledger p={p} />;
    case "dossier":
      return <Dossier p={p} />;
    case "broadsheet":
      return <Broadsheet p={p} />;
    default:
      return <Editorial p={p} />;
  }
}
