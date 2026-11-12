"use client";

import { AnimatePresence, motion } from "motion/react";
import { Fragment, useCallback, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { coverOf, type Portfolio, type Section, type SectionStyle } from "@/lib/types";
import { Photo, Reveal, nn, reducedNow, useMotionLevel } from "./fx";
import { SectionAside, SectionLinks, SectionTitleLink, UiIcon, gridCols, headline } from "./shared";

/* ── section styles ─────────────────────────────────────────────────────────
   The shape the page's plain sections take, picked once for the page in the
   builder and the same in every theme: a timeline, a sliding row, side tabs,
   chips. Like the components in `components.tsx`, every colour, face and
   corner comes from the theme the style sits in — `--color-*` from
   `groundStyle()`, `--fc-radius` / `--fc-surface` / `--fc-line` from the
   theme root — so a timeline is calm on Meridian and neon on Arcade without
   either theme knowing what a timeline is.

   A theme wraps its own cards in `StyledSections`, which draws the picked
   style in their place, or the theme's cards when the style is "theme".
   Feature bands (sections with components) still run after it, unchanged.

   It was written per tab. A section files under nothing but its own title
   now, so there is one style for the page (`layout.sectionStyle`), applied
   to each run of plain sections. The same shapes also draw a resume list's
   entries — `renderStyle()` is what the list component's Carousel, Side tabs
   and Spotlight looks call.

   Motion stays quiet and frame-aware: reveals, a lift on hover, a panel
   cross-fading between side tabs. Nothing reads the window of this module.
   ──────────────────────────────────────────────────────────────────────── */

const EASE = [0.16, 1, 0.3, 1] as const;

export type PickedStyle = Exclude<SectionStyle, "theme">;

/** The style the author picked for the page, or null to let the theme draw it. */
export function pickedStyle(p: Portfolio): PickedStyle | null {
  const s = p.layout.sectionStyle;
  return !s || s === "theme" ? null : s;
}

/**
 * A run of plain sections in the page's style, or — when it is left to the
 * theme — `children`, which is the theme's own markup for them.
 */
export function StyledSections({ p, sections, children }: { p: Portfolio; sections: Section[]; children?: ReactNode }) {
  const style = pickedStyle(p);
  if (!style) return <>{children}</>;
  if (sections.length === 0) return null;
  // Keyed by what it holds, so a tabbed theme switching sections starts fresh.
  return <Fragment key={sections[0].id}>{renderStyle(p, style, sections, "Sections")}</Fragment>;
}

/** Entries in one style. `label` names the group for its scroll buttons. */
export function renderStyle(p: Portfolio, style: PickedStyle, sections: Section[], label: string) {
  switch (style) {
    case "grid":
      return <GridStyle p={p} sections={sections} />;
    case "timeline":
      return <TimelineStyle p={p} sections={sections} />;
    case "carousel":
      return <CarouselStyle p={p} sections={sections} label={label} />;
    case "tabs":
      return <SideTabsStyle p={p} sections={sections} label={label} />;
    case "list":
      return <ListStyle p={p} sections={sections} />;
    case "spotlight":
      return <SpotlightStyle p={p} sections={sections} />;
    case "chips":
      return <ChipsStyle p={p} sections={sections} />;
  }
}

/* ── reading an entry ─────────────────────────────────────────────────── */

const DATE_RE = /\b(?:19|20)\d{2}\b|\bpresent\b|\bcurrent\b|\bongoing\b/i;
const BULLET_RE = /^\s*[•\-*–]\s+/;

/**
 * An entry's description split into the parts a timeline or a side tab sets
 * apart: its dates, a subtitle (the organisation, the place) and the body.
 *
 * A section has no date field, so this reads the description's first line —
 * which is exactly where the resume's roles put "Company · City · 2021 –
 * Present", and where people type dates by hand. Only a short first line that
 * names a year (or "Present") counts; anything else stays the body.
 */
export function entryMeta(s: Section): { date: string; sub: string; body: string } {
  const lines = s.description.split("\n");
  const first = (lines[0] ?? "").trim();
  const rest = lines.slice(1).join("\n").trim();
  if (first && first.length <= 140 && !BULLET_RE.test(first) && DATE_RE.test(first)) {
    const parts = first.split(/\s+[·|]\s+/).map((t) => t.trim()).filter(Boolean);
    return {
      date: parts.filter((t) => DATE_RE.test(t)).join(" · "),
      sub: parts.filter((t) => !DATE_RE.test(t)).join(" · "),
      body: rest,
    };
  }
  // A resume role with no dates still leads with its organisation.
  if (s.id.startsWith("resume-") && rest && first && !BULLET_RE.test(first)) {
    return { date: "", sub: first, body: rest };
  }
  return { date: "", sub: "", body: s.description.trim() };
}

function isCurrent(date: string) {
  return /\b(?:present|current|now|ongoing)\b/i.test(date);
}

/** Items for a chip row: split on the separators people actually type. */
export function chipsOf(text: string): string[] {
  return text
    .split(/\s*(?:[·,;|\n•]|\s-\s)\s*/)
    .map((t) => t.replace(BULLET_RE, "").trim())
    .filter(Boolean);
}

/**
 * A description as paragraphs and bullet lists. Lines that start with a
 * bullet become a real list with the accent's marks; everything else keeps
 * its line breaks.
 */
function Body({ text, className = "" }: { text: string; className?: string }) {
  if (!text) return null;
  const groups: Array<{ kind: "p" | "ul"; lines: string[] }> = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const kind = BULLET_RE.test(line) ? "ul" : "p";
    const last = groups[groups.length - 1];
    if (last && last.kind === kind) last.lines.push(line);
    else groups.push({ kind, lines: [line] });
  }
  return (
    <div className={`ss-body flex flex-col gap-2.5 ${className}`}>
      {groups.map((g, i) =>
        g.kind === "ul" ? (
          <ul key={i} className="ss-bullets m-0 flex list-none flex-col gap-1.5 p-0">
            {g.lines.map((l, j) => (
              <li key={j}>{l.replace(BULLET_RE, "")}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="m-0 whitespace-pre-line">
            {g.lines.join("\n")}
          </p>
        ),
      )}
    </div>
  );
}

function Extras({ p, section }: { p: Portfolio; section: Section }) {
  return (
    <div className="flex flex-col items-start gap-3 empty:hidden">
      <SectionAside p={p} section={section} />
      <SectionLinks p={p} section={section} />
    </div>
  );
}

/** Where a picture would be: the accent, washed, with the entry's number. */
function Placeholder({ index, title }: { index: number; title: string }) {
  return (
    <div aria-hidden className="ss-placeholder absolute inset-0 grid place-items-center">
      <span className="font-heading ss-placeholder-mark">{title.trim()[0]?.toUpperCase() || nn(index)}</span>
    </div>
  );
}

/* ── Cards ────────────────────────────────────────────────────────────── */

function GridStyle({ p, sections }: { p: Portfolio; sections: Section[] }) {
  return (
    <div className={`grid gap-5 ${gridCols(p)}`}>
      {sections.map((s, i) => {
        const m = entryMeta(s);
        return (
          <Reveal key={s.id} kind="up" delay={Math.min(i, 6) * 70} className="h-full">
            <article className="fc-card ss-lift flex h-full flex-col overflow-hidden">
              <div className="relative aspect-[16/9] overflow-hidden">
                {coverOf(s) ? (
                  <Photo asset={coverOf(s)!} className="ss-zoom absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Placeholder index={i} title={s.title} />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-6">
                {m.date && <span className="mono-label ss-date">{m.date}</span>}
                <SectionTitleLink
                  p={p}
                  section={s}
                  className="font-heading text-[21px] leading-[1.2] tracking-[-0.01em] hover:underline"
                />
                {m.sub && <span className="ss-sub text-[14px]">{m.sub}</span>}
                <Body text={m.body} className="text-muted text-[15px] leading-[1.6]" />
                <div className="mt-auto pt-1">
                  <Extras p={p} section={s} />
                </div>
              </div>
            </article>
          </Reveal>
        );
      })}
    </div>
  );
}

/* ── Timeline ─────────────────────────────────────────────────────────── */

function TimelineStyle({ p, sections }: { p: Portfolio; sections: Section[] }) {
  return (
    <ol className="ss-timeline m-0 list-none p-0">
      {sections.map((s, i) => {
        const m = entryMeta(s);
        const now = isCurrent(m.date);
        return (
          <Reveal as="li" key={s.id} kind="left" delay={Math.min(i, 6) * 70} className="ss-tl-item">
            <div className="ss-tl-date mono-label">{m.date}</div>
            <div aria-hidden className="ss-tl-rail">
              <span className={`ss-tl-dot ${now ? "is-now" : ""}`} />
            </div>
            <div className="ss-tl-content fc-card ss-lift flex flex-col gap-2.5 p-5 md:p-6">
              {m.date && <span className="ss-tl-date-inline mono-label">{m.date}</span>}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <SectionTitleLink
                  p={p}
                  section={s}
                  className="font-heading text-[20px] leading-[1.2] tracking-[-0.01em] hover:underline md:text-[22px]"
                />
                {now && <span className="ss-now">Now</span>}
              </div>
              {m.sub && <span className="ss-sub text-[15px] font-medium">{m.sub}</span>}
              <Body text={m.body} className="text-muted text-[15px] leading-[1.6]" />
              {coverOf(s) && (
                <div className="relative mt-1 aspect-[16/7] overflow-hidden rounded-[calc(var(--fc-radius)*0.6)]">
                  <Photo asset={coverOf(s)!} className="absolute inset-0 h-full w-full object-cover" />
                </div>
              )}
              <Extras p={p} section={s} />
            </div>
          </Reveal>
        );
      })}
    </ol>
  );
}

/* ── Carousel ─────────────────────────────────────────────────────────── */

function CarouselStyle({ p, sections, label }: { p: Portfolio; sections: Section[]; label: string }) {
  const trackId = `ss-track-${useId().replace(/:/g, "")}`;
  // Steps the row by most of its own width, inside its own document, and
  // never the page: the row is the only thing that scrolls sideways.
  const step = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, dir: 1 | -1) => {
      const track = e.currentTarget.ownerDocument.getElementById(trackId);
      if (!track) return;
      track.scrollBy({ left: dir * track.clientWidth * 0.85, behavior: reducedNow(track) ? "auto" : "smooth" });
    },
    [trackId],
  );

  return (
    <div className="relative min-w-0">
      {sections.length > 1 && (
        <div className="mb-4 flex justify-end gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            aria-label={`Scroll ${label} back`}
            aria-controls={trackId}
            onClick={(e) => step(e, -1)}
          >
            <UiIcon id="back" size={16} />
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            aria-label={`Scroll ${label} forward`}
            aria-controls={trackId}
            onClick={(e) => step(e, 1)}
          >
            <UiIcon id="chevron" size={16} />
          </button>
        </div>
      )}
      <div
        id={trackId}
        className="fx-rail ss-carousel flex snap-x snap-mandatory gap-4 overflow-x-auto pt-2 pb-4 md:gap-5"
      >
        {sections.map((s, i) => {
          const m = entryMeta(s);
          return (
            <Reveal
              key={s.id}
              kind="up"
              delay={Math.min(i, 5) * 70}
              className="w-[80%] flex-none snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2.5rem)/3)]"
            >
              <article className="fc-card ss-lift flex h-full flex-col overflow-hidden">
                <div className="ss-poster relative aspect-[4/3] overflow-hidden">
                  {coverOf(s) ? (
                    <Photo asset={coverOf(s)!} className="ss-zoom absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <Placeholder index={i} title={s.title} />
                  )}
                  <div className="ss-poster-shade absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5">
                    {m.date && <span className="mono-label" style={{ color: "inherit" }}>{m.date}</span>}
                    <SectionTitleLink
                      p={p}
                      section={s}
                      className="font-heading text-[20px] leading-[1.15] tracking-[-0.01em] hover:underline"
                    />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  {m.sub && <span className="ss-sub text-[14px]">{m.sub}</span>}
                  <Body text={m.body} className="ss-clamp text-muted text-[14.5px] leading-[1.6]" />
                  <div className="mt-auto">
                    <Extras p={p} section={s} />
                  </div>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

/* ── Side tabs ────────────────────────────────────────────────────────── */

function SideTabsStyle({ p, sections, label }: { p: Portfolio; sections: Section[]; label: string }) {
  const [picked, setPicked] = useState(0);
  const base = useId().replace(/:/g, "");
  const level = useMotionLevel();
  const open = Math.min(picked, sections.length - 1);
  const s = sections[open];
  const m = entryMeta(s);
  // "Razorpay · Bengaluru": the organisation names the tab and sits beside
  // the title; the place joins the dates underneath.
  const [org = "", ...place] = m.sub.split(" · ");
  const when = [m.date, ...place].filter(Boolean).join(" · ");

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? (open + 1) % sections.length
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? (open - 1 + sections.length) % sections.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? sections.length - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    setPicked(next);
    e.currentTarget.ownerDocument.getElementById(`${base}-tab-${next}`)?.focus();
  };

  return (
    <Reveal kind="up" className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(180px,260px)_minmax(0,1fr)] md:gap-10">
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="vertical"
        onKeyDown={onKey}
        className="fx-rail ss-sidetabs flex min-w-0 gap-1 overflow-x-auto md:flex-col md:overflow-visible"
      >
        {sections.map((t, i) => {
          const tm = entryMeta(t);
          const on = i === open;
          return (
            <button
              key={t.id}
              id={`${base}-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${base}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => setPicked(i)}
              className={`ss-sidetab flex-none text-left ${on ? "is-on" : ""}`}
            >
              <span className="block truncate text-[15px] font-semibold">{tm.sub.split(" · ")[0] || t.title}</span>
              {tm.date && <span className="mono-label mt-0.5 block truncate">{tm.date}</span>}
            </button>
          );
        })}
      </div>
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${open}`} className="min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={s.id}
            initial={level === "off" ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={level === "off" ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="flex flex-col gap-3"
          >
            <h3 className="m-0" style={{ ...headline("clamp(24px, 2.6vw, 32px)"), lineHeight: 1.15 }}>
              <SectionTitleLink p={p} section={s} className="hover:underline" />
              {org && <span className="ss-sub"> · {org}</span>}
            </h3>
            {when && (
              <span className="mono-label flex items-center gap-2">
                {isCurrent(m.date) && <span className="fx-pulse flex-none" />}
                {when}
              </span>
            )}
            <Body text={m.body} className="text-[16px] leading-[1.7]" />
            {coverOf(s) && (
              <div className="fc-card relative mt-2 aspect-[16/8] overflow-hidden">
                <Photo asset={coverOf(s)!} className="absolute inset-0 h-full w-full object-cover" />
              </div>
            )}
            <Extras p={p} section={s} />
          </motion.div>
        </AnimatePresence>
      </div>
    </Reveal>
  );
}

/* ── List ─────────────────────────────────────────────────────────────── */

function ListStyle({ p, sections }: { p: Portfolio; sections: Section[] }) {
  return (
    <ul className="ss-list m-0 list-none p-0">
      {sections.map((s, i) => {
        const m = entryMeta(s);
        return (
          <Reveal
            as="li"
            key={s.id}
            kind="up"
            delay={Math.min(i, 8) * 50}
            className="ss-list-row grid grid-cols-1 gap-x-8 gap-y-2 py-5 md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <SectionTitleLink
                p={p}
                section={s}
                className="font-heading text-[18px] leading-[1.3] tracking-[-0.005em] hover:underline md:text-[19px]"
              />
              {m.sub && <span className="ss-sub text-[14px]">{m.sub}</span>}
              <Body text={m.body} className="text-muted max-w-[72ch] text-[15px] leading-[1.6]" />
              <Extras p={p} section={s} />
            </div>
            {m.date && <span className="mono-label md:pt-1.5 md:text-right">{m.date}</span>}
          </Reveal>
        );
      })}
    </ul>
  );
}

/* ── Spotlight ────────────────────────────────────────────────────────── */

function SpotlightStyle({ p, sections }: { p: Portfolio; sections: Section[] }) {
  return (
    <div className="flex flex-col gap-14 md:gap-24">
      {sections.map((s, i) => {
        const m = entryMeta(s);
        const flip = i % 2 === 1;
        return (
          <article
            key={s.id}
            className="grid grid-cols-1 items-center gap-7 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-14"
          >
            <Reveal kind={flip ? "right" : "left"} className={flip ? "md:order-2" : ""}>
              <div className="fc-card ss-lift relative aspect-[4/3] overflow-hidden">
                {coverOf(s) ? (
                  <Photo asset={coverOf(s)!} className="ss-zoom absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Placeholder index={i} title={s.title} />
                )}
              </div>
            </Reveal>
            <Reveal kind="up" delay={120} className="flex min-w-0 flex-col items-start gap-4">
              <span className="mono-label flex items-center gap-3">
                <span className="ss-date">{nn(i)}</span>
                {m.date && <span>{m.date}</span>}
              </span>
              <h3 className="m-0" style={{ ...headline("clamp(28px, 3.4vw, 44px)"), lineHeight: 1.05 }}>
                <SectionTitleLink p={p} section={s} className="hover:underline" />
              </h3>
              {m.sub && <span className="ss-sub text-[16px]">{m.sub}</span>}
              <Body text={m.body} className="text-muted text-[16px] leading-[1.7]" />
              <Extras p={p} section={s} />
            </Reveal>
          </article>
        );
      })}
    </div>
  );
}

/* ── Chips ────────────────────────────────────────────────────────────── */

function ChipsStyle({ p, sections }: { p: Portfolio; sections: Section[] }) {
  return (
    <div className={`grid gap-4 ${sections.length > 1 ? "sm:grid-cols-2" : ""} ${sections.length > 2 ? "lg:grid-cols-3" : ""}`}>
      {sections.map((s, i) => {
        const m = entryMeta(s);
        const chips = chipsOf(m.body);
        // A long item is a sentence, not a skill: show the text instead.
        const asChips = chips.length > 0 && chips.every((c) => c.length <= 40);
        return (
          <Reveal key={s.id} kind="up" delay={Math.min(i, 6) * 60} className="h-full">
            <article className="fc-card flex h-full flex-col gap-4 p-6">
              <SectionTitleLink
                p={p}
                section={s}
                className="font-heading text-[18px] leading-[1.25] tracking-[-0.005em] hover:underline"
              />
              {m.sub && <span className="ss-sub -mt-2 text-[14px]">{m.sub}</span>}
              {asChips ? (
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {chips.map((c, j) => (
                    <li key={`${c}-${j}`} className="tag ss-chip">
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <Body text={m.body} className="text-muted text-[15px] leading-[1.6]" />
              )}
              <div className="mt-auto">
                <Extras p={p} section={s} />
              </div>
            </article>
          </Reveal>
        );
      })}
    </div>
  );
}

/* ── suggesting a style ───────────────────────────────────────────────── */

/**
 * The style a set of sections reads best in, from what they hold. Only ever
 * offered — the builder shows it as "Suggested" and one button applies it;
 * nothing changes a page on its own.
 *
 * It used to read the tab's name too ("Experience" meant a timeline). There
 * is no tab now, and a career or a skills list is a component with a look of
 * its own, so this goes by content alone.
 */
export function suggestStyle(sections: Section[]): PickedStyle {
  const dated = sections.filter((s) => entryMeta(s).date).length;
  const pictured = sections.filter((s) => coverOf(s)).length;
  if (dated >= 2 && dated >= sections.length / 2) return "timeline";
  if (
    sections.length > 1 &&
    pictured === 0 &&
    sections.every((s) => {
      const chips = chipsOf(entryMeta(s).body);
      return chips.length > 1 && chips.every((c) => c.length <= 40);
    })
  )
    return "chips";
  if (pictured > 0 && sections.length <= 3) return "spotlight";
  if (sections.length > 4) return "carousel";
  return pictured > 0 ? "grid" : "list";
}

/** Exported for the builder's style picker; the published page never needs it. */
export function StyleIcon({ id }: { id: SectionStyle }): ReactNode {
  const c = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const };
  const box = (x: number, y: number, w: number, h: number, k?: string) => (
    <rect key={k ?? `${x}-${y}`} x={x} y={y} width={w} height={h} rx={1.5} {...c} />
  );
  let body: ReactNode;
  switch (id) {
    case "theme":
      body = (
        <>
          {box(3, 4, 18, 16)}
          <path d="M3 9h18" {...c} />
          <circle cx={6} cy={6.5} r={0.6} fill="currentColor" />
        </>
      );
      break;
    case "grid":
      body = [box(3, 4, 8, 7), box(13, 4, 8, 7), box(3, 13, 8, 7), box(13, 13, 8, 7)];
      break;
    case "timeline":
      body = (
        <>
          <path d="M7 3v18" {...c} />
          <circle cx={7} cy={6} r={1.8} {...c} />
          <circle cx={7} cy={12} r={1.8} {...c} />
          <circle cx={7} cy={18} r={1.8} {...c} />
          <path d="M11 6h9M11 12h7M11 18h8" {...c} />
        </>
      );
      break;
    case "carousel":
      body = (
        <>
          {box(6, 5, 12, 14)}
          <path d="M3 7v10M21 7v10" {...c} />
        </>
      );
      break;
    case "tabs":
      body = (
        <>
          <path d="M3 5h5M3 10h5M3 15h5" {...c} />
          <path d="M3 5h5" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
          {box(11, 4, 10, 16)}
        </>
      );
      break;
    case "list":
      body = <path d="M3 6h18M3 12h18M3 18h18M17 4v4M17 10v4M17 16v4" {...c} />;
      break;
    case "spotlight":
      body = (
        <>
          {box(3, 4, 9, 7)}
          <path d="M15 6h6M15 9h4" {...c} />
          {box(12, 13, 9, 7)}
          <path d="M3 15h6M3 18h4" {...c} />
        </>
      );
      break;
    case "chips":
      body = [box(3, 5, 7, 4, "a"), box(12, 5, 9, 4, "b"), box(3, 11, 10, 4, "c"), box(15, 11, 6, 4, "d"), box(3, 17, 6, 4, "e")];
      break;
  }
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden>
      {body}
    </svg>
  );
}
