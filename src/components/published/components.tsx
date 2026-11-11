"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { LinkIcon, iconFor } from "@/lib/icons";
import {
  assetSrc,
  componentHasContent,
  coverOf,
  galleryImages,
  isListBlock,
  lookOf,
  type Block,
  type ClientsBlock,
  type ContactBlock,
  type FaqBlock,
  type GalleryBlock,
  type Portfolio,
  type ResumeListBlock,
  type Section,
  type ServicesBlock,
  type StatsBlock,
  type TabsBlock,
  type TestimonialsBlock,
  type TimelineBlock,
} from "@/lib/types";
import { listEntries, type ListEntry } from "@/lib/resume";
import { CountUp, initials, useMotionLevel } from "./fx";
import {
  HeaderLinks,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
  UiIcon,
  headline,
  href,
  usePublishedHandle,
  usePublishedPrivacy,
  useRecordClick,
} from "./shared";

/* ── components on the published page ─────────────────────────────────────
   One set of renderers for all five themes. They take every colour, face
   and corner from the theme they sit in — `--color-*` from `groundStyle()`,
   `--fc-radius` and `--fc-surface` from the theme root in globals.css — so a
   timeline is a calm ruled list on Meridian and a neon one on Arcade without
   either theme learning what a timeline is.

   A section with components is a *feature*: it leaves the theme's grid of
   cards and runs full width as a band after them, where a gallery and a
   timeline have room. Plain sections — a heading and a cover — stay cards.

   Motion is the quiet kind: a lift on hover, a photograph easing 2% inside
   its frame, an indicator sliding between tabs, an answer opening. Nothing
   here animates because the page scrolled, and nothing turns on a timer.
   ──────────────────────────────────────────────────────────────────────── */

const EASE = [0.16, 1, 0.3, 1] as const;

/** The components a visitor would actually see. */
export function shownBlocks(section: Section): Block[] {
  return (section.blocks ?? [])
    .filter((b) => componentHasContent(b))
    .filter((b) => b.type !== "contact" || isContactShown(b))
    // A gallery whose pictures the section no longer holds has nothing to show.
    .filter((b) => b.type !== "gallery" || galleryImages(section, b).length > 0);
}

function isContactShown(b: ContactBlock) {
  return Boolean(b.text || b.email || b.phone || b.location || b.ctaUrl);
}

/** A section that runs as a full-width band rather than a card. */
export function isFeature(section: Section): boolean {
  return shownBlocks(section).length > 0;
}

/** Cards first, then bands, each keeping the author's order. */
export function splitFeatures(sections: Section[]): { cards: Section[]; features: Section[] } {
  return {
    cards: sections.filter((s) => !isFeature(s)),
    features: sections.filter(isFeature),
  };
}

/* ── the band ─────────────────────────────────────────────────────────── */

export function FeatureBand({
  p,
  section,
  className = "",
  style,
}: {
  p: Portfolio;
  section: Section;
  className?: string;
  style?: CSSProperties;
}) {
  const blocks = shownBlocks(section);
  const cover = coverOf(section);
  const media = cover !== null;

  return (
    <article className={`fc-band ${className}`} style={style} aria-labelledby={`band-${section.id}`}>
      <div className={`grid grid-cols-1 gap-8 md:gap-12 ${media ? "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start" : ""}`}>
        <div className="flex min-w-0 flex-col items-start gap-4">
          <h3 id={`band-${section.id}`} className="m-0" style={{ ...headline("clamp(28px, 3.4vw, 44px)"), lineHeight: 1.05 }}>
            <SectionTitleLink p={p} section={section} className="font-heading fc-title-link" />
          </h3>
          {section.description && (
            <p className="text-muted m-0 max-w-[60ch] text-[16.5px] leading-[1.7] whitespace-pre-line">{section.description}</p>
          )}
          <SectionAside p={p} section={section} />
          <SectionLinks p={p} section={section} />
        </div>
        {cover && (
          <figure className="fc-frame m-0 aspect-[16/10]">
            {/* An API URL — nothing for next/image to optimise. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetSrc(cover)} alt={section.title} className="published-photo fc-photo h-full w-full object-cover" />
          </figure>
        )}
      </div>

      {blocks.length > 0 && (
        <div className="mt-12 flex flex-col gap-14 md:mt-16 md:gap-20">
          {blocks.map((b) => (
            <ComponentView key={b.id} p={p} section={section} block={b} />
          ))}
        </div>
      )}
    </article>
  );
}

/* ── gallery ──────────────────────────────────────────────────────────── */

/**
 * A set of the section's pictures, laid out the way its author chose. No
 * captions — the section says what it is.
 *
 * Mosaic: the first runs full width and the rest share rows below it, each
 * row growing to fill its width so a count that does not divide by three
 * never leaves a hole. Grid: every picture the same. Strip: one row that
 * scrolls inside its own box — the page itself never scrolls sideways.
 */
function GalleryView({ section, block }: { section: Section; block: GalleryBlock }) {
  const images = galleryImages(section, block);
  const alt = block.title || section.title;
  const frame = (asset: (typeof images)[number], i: number, className: string) => (
    <figure key={asset.id ?? i} className={`fc-frame m-0 ${className}`}>
      {/* API URLs — nothing for next/image to optimise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assetSrc(asset)}
        alt={i === 0 ? alt : ""}
        loading={i === 0 ? undefined : "lazy"}
        className="published-photo fc-photo h-full w-full object-cover"
      />
    </figure>
  );
  const tile = "aspect-[4/3] max-h-[26rem] min-w-0 grow basis-[calc(50%-0.5rem)] sm:basis-[calc(33.333%-0.75rem)]";

  if (block.layout === "strip") {
    return (
      <div className="fc-strip flex snap-x gap-2 overflow-x-auto pb-2 md:gap-3" tabIndex={0} role="group" aria-label={`${alt} — pictures`}>
        {images.map((asset, i) => frame(asset, i, "aspect-[4/3] w-[78%] flex-none snap-start sm:w-[46%] lg:w-[36%]"))}
      </div>
    );
  }
  if (block.layout === "grid") {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3">{images.map((asset, i) => frame(asset, i, "aspect-square"))}</div>
    );
  }
  if (images.length === 2) {
    return <div className="grid grid-cols-2 gap-2 md:gap-3">{images.map((asset, i) => frame(asset, i, "aspect-[4/5]"))}</div>;
  }
  const [lead, ...rest] = images;
  return (
    <div className="flex flex-col gap-2 md:gap-3">
      {frame(lead, 0, "aspect-[16/9]")}
      {rest.length > 0 && <div className="flex flex-wrap gap-2 md:gap-3">{rest.map((asset, i) => frame(asset, i + 1, tile))}</div>}
    </div>
  );
}

/* ── one component ────────────────────────────────────────────────────── */

export function ComponentView({ p, section, block }: { p: Portfolio; section: Section; block: Block }) {
  return (
    <section className="min-w-0" aria-label={block.title || undefined}>
      {block.title && (
        <h4 className="m-0 mb-6 md:mb-8" style={{ ...headline("clamp(22px, 2.4vw, 30px)"), lineHeight: 1.1 }}>
          {block.title}
        </h4>
      )}
      {renderBlock(p, section, block)}
    </section>
  );
}

function renderBlock(p: Portfolio, section: Section, b: Block) {
  if (isListBlock(b)) return <ResumeListView p={p} section={section} block={b} />;
  switch (b.type) {
    case "gallery":
      return <GalleryView section={section} block={b} />;
    case "timeline":
      return <TimelineView block={b} />;
    case "testimonials":
      return <TestimonialsView block={b} />;
    case "clients":
      return <ClientsView p={p} section={section} block={b} />;
    case "tabs":
      return <TabsView block={b} />;
    case "stats":
      return <StatsView block={b} />;
    case "services":
      return <ServicesView block={b} />;
    case "faq":
      return <FaqView block={b} />;
    case "contact":
      return <ContactView p={p} section={section} block={b} />;
  }
}

const filled = <T extends { id: string }>(items: T[]) =>
  items.filter((item) => Object.entries(item).some(([k, v]) => k !== "id" && typeof v === "string" && v.trim()));

function TimelineView({ block }: { block: TimelineBlock }) {
  const items = filled(block.items);
  return (
    <ol className="fc-timeline m-0 list-none p-0">
      {items.map((item) => (
        <li key={item.id} className="fc-timeline-item grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[8rem_1.25rem_minmax(0,1fr)] md:gap-x-6">
          <span className="font-heading figure hidden pt-0.5 text-right text-[17px] md:block" style={{ color: "var(--color-mark)" }}>
            {item.date}
          </span>
          <span aria-hidden className="fc-timeline-dot" />
          <div className="min-w-0 pb-9">
            <span className="font-heading figure mb-1 block text-[15px] md:hidden" style={{ color: "var(--color-mark)" }}>
              {item.date}
            </span>
            {item.title && <p className="m-0 text-[17.5px] font-semibold leading-snug">{item.title}</p>}
            {item.text && <p className="text-muted m-0 mt-1.5 max-w-[60ch] text-[15.5px] leading-[1.65]">{item.text}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ── the resume's lists ───────────────────────────────────────────────── */

/**
 * Experience, education, skills and the rest, placed in a section. The
 * entries come from the resume — the component holds none — and are drawn
 * in the look its author picked: a timeline, ruled rows, cards or tags.
 * One renderer for all six, because `listEntries()` hands every list over
 * in the same shape.
 */
function ResumeListView({ p, section, block }: { p: Portfolio; section: Section; block: ResumeListBlock }) {
  const entries = listEntries(p.resume, block.type);
  const record = useRecordClick();
  const handle = usePublishedHandle();
  if (entries.length === 0) return null;

  const title = (e: ListEntry, className: string) =>
    e.url ? (
      <a
        href={href(e.url)}
        target="_blank"
        rel="noopener noreferrer"
        className={`fc-title-link ${className}`}
        onClick={() => record(handle, p.slug, section.id)}
      >
        {e.title}
      </a>
    ) : (
      <span className={className}>{e.title}</span>
    );
  const detail = (e: ListEntry) => (
    <>
      {e.lines.length === 1 && <p className="text-muted m-0 mt-2 max-w-[60ch] text-[15.5px] leading-[1.65]">{e.lines[0]}</p>}
      {e.lines.length > 1 && (
        <ul className="text-muted m-0 mt-2.5 flex max-w-[62ch] list-none flex-col gap-1.5 p-0 text-[15.5px] leading-[1.6]">
          {e.lines.map((l, i) => (
            <li key={i} className="grid grid-cols-[0.9rem_minmax(0,1fr)]">
              <span aria-hidden style={{ color: "var(--color-mark)" }}>
                ·
              </span>
              {l}
            </li>
          ))}
        </ul>
      )}
      {e.tags.length > 0 && <Tags tags={e.tags} />}
    </>
  );

  switch (lookOf(block)) {
    case "timeline":
      return (
        <ol className="fc-timeline m-0 list-none p-0">
          {entries.map((e) => (
            <li
              key={e.id}
              className="fc-timeline-item grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[11rem_1.25rem_minmax(0,1fr)] md:gap-x-6"
            >
              <span className="font-heading figure hidden pt-0.5 text-right text-[16px] md:block" style={{ color: "var(--color-mark)" }}>
                {e.date}
              </span>
              <span aria-hidden className="fc-timeline-dot" />
              <div className="min-w-0 pb-9">
                {e.date && (
                  <span className="font-heading figure mb-1 block text-[15px] md:hidden" style={{ color: "var(--color-mark)" }}>
                    {e.date}
                  </span>
                )}
                <p className="m-0 text-[17.5px] leading-snug font-semibold">{title(e, "")}</p>
                {e.sub && <p className="m-0 mt-0.5 text-[15px]">{e.sub}</p>}
                {detail(e)}
              </div>
            </li>
          ))}
        </ol>
      );

    case "cards":
      return (
        <ul className={`m-0 grid list-none grid-cols-1 gap-4 p-0 ${entries.length === 1 ? "" : "md:grid-cols-2"}`}>
          {entries.map((e) => (
            <li key={e.id} className="fc-card flex min-w-0 flex-col p-6 md:p-7">
              {e.date && (
                <span className="font-heading figure mb-2 text-[14px]" style={{ color: "var(--color-mark)" }}>
                  {e.date}
                </span>
              )}
              {e.title && title(e, "font-heading text-[21px] leading-snug")}
              {e.sub && <span className="mt-1 text-[15px]">{e.sub}</span>}
              {detail(e)}
            </li>
          ))}
        </ul>
      );

    case "tags": {
      // Languages are each their own entry; as tags they read as one row.
      const groups = entries.some((e) => e.tags.length > 0)
        ? entries.map((e) => ({ id: e.id, name: e.title, tags: e.tags }))
        : [{ id: block.id, name: "", tags: entries.map((e) => (e.sub ? `${e.title} — ${e.sub}` : e.title)) }];
      return (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <div key={g.id} className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-[11rem_minmax(0,1fr)] md:items-baseline">
              {g.name ? <span className="font-heading text-[18px] leading-snug">{g.name}</span> : <span aria-hidden className="hidden md:block" />}
              <Tags tags={g.tags} flush />
            </div>
          ))}
        </div>
      );
    }

    case "list":
      return (
        <ul className="m-0 list-none p-0" style={{ borderTop: "1px solid var(--color-divider)" }}>
          {entries.map((e) => (
            <li
              key={e.id}
              className="fc-row grid grid-cols-1 gap-x-10 gap-y-1 py-5 md:grid-cols-[minmax(0,1fr)_minmax(7rem,auto)] md:items-baseline"
              style={{ borderBottom: "1px solid var(--color-divider)" }}
            >
              <div className="min-w-0">
                {e.title && title(e, "font-heading text-[20px] leading-snug")}
                {e.sub && <span className="text-muted mt-0.5 block text-[15px]">{e.sub}</span>}
                {e.tags.length > 0 ? <p className="text-muted m-0 mt-1 max-w-[70ch] text-[15.5px] leading-[1.65]">{e.tags.join(" · ")}</p> : detail(e)}
              </div>
              {e.date && (
                <span className="text-[15px] font-semibold whitespace-nowrap tabular-nums md:text-right" style={{ color: "var(--color-mark)" }}>
                  {e.date}
                </span>
              )}
            </li>
          ))}
        </ul>
      );
  }
}

function Tags({ tags, flush }: { tags: string[]; flush?: boolean }) {
  return (
    <ul className={`m-0 flex list-none flex-wrap gap-2 p-0 ${flush ? "" : "mt-3"}`}>
      {tags.map((t) => (
        <li key={t} className="fc-chip">
          {t}
        </li>
      ))}
    </ul>
  );
}

function TestimonialsView({ block }: { block: TestimonialsBlock }) {
  const items = filled(block.items);
  const cols = items.length === 1 ? "" : items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3";
  return (
    <ul className={`m-0 grid list-none grid-cols-1 gap-4 p-0 ${cols}`}>
      {items.map((item) => (
        <li key={item.id} className="fc-card flex flex-col justify-between gap-8 p-6 md:p-8">
          <blockquote className={`font-heading m-0 leading-[1.4] ${items.length === 1 ? "text-[clamp(22px,2.6vw,32px)]" : "text-[19px]"}`}>
            “{item.quote}”
          </blockquote>
          {(item.name || item.role) && (
            <footer className="flex items-center gap-3">
              <span
                aria-hidden
                className="font-heading grid h-11 w-11 flex-none place-items-center rounded-full text-[14px]"
                style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
              >
                {initials(item.name || item.role)}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                {item.name && <span className="text-[15px] font-semibold">{item.name}</span>}
                {item.role && <span className="text-muted text-[13.5px]">{item.role}</span>}
              </span>
            </footer>
          )}
        </li>
      ))}
    </ul>
  );
}

function ClientsView({ p, section, block }: { p: Portfolio; section: Section; block: ClientsBlock }) {
  const handle = usePublishedHandle();
  const record = useRecordClick();
  const items = block.items.filter((c) => c.name.trim());
  return (
    // Per-cell rules, not a gap over a coloured ground: a part-filled last
    // row would otherwise show the ground as empty blocks.
    <ul className="fc-wall m-0 grid list-none grid-cols-2 p-0 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((c) => {
        const name = <span className="font-heading text-[clamp(17px,1.7vw,22px)] leading-tight">{c.name}</span>;
        return (
          <li key={c.id} className="fc-wall-cell">
            {c.url.trim() ? (
              <a
                href={href(c.url)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => record(handle, p.slug, section.id)}
                className="fc-wall-name flex h-full min-h-[96px] items-center justify-between gap-3 px-5 py-6 no-underline"
              >
                {name}
                <UiIcon id="out" size={15} />
              </a>
            ) : (
              <span className="fc-wall-name flex h-full min-h-[96px] items-center px-5 py-6">{name}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Tabs a visitor switches; arrow keys move between them, as a tablist should. */
function TabsView({ block }: { block: TabsBlock }) {
  const items = block.items.filter((t) => t.label.trim() || t.text.trim());
  const [active, setActive] = useState(0);
  const group = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const level = useMotionLevel();
  const current = items[Math.min(active, items.length - 1)];

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (active + delta + items.length) % items.length;
    setActive(next);
    refs.current[next]?.focus();
  }

  if (!current) return null;
  return (
    <LayoutGroup id={group}>
      <div role="tablist" aria-label={block.title || "Tabs"} onKeyDown={onKey} className="fc-tabs flex max-w-full gap-1 overflow-x-auto">
        {items.map((t, i) => {
          const on = i === active;
          return (
            <button
              key={t.id}
              ref={(node) => {
                refs.current[i] = node;
              }}
              type="button"
              role="tab"
              id={`${group}-tab-${i}`}
              aria-selected={on}
              aria-controls={`${group}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className="relative min-h-[44px] flex-none cursor-pointer px-4 text-[15px] font-medium whitespace-nowrap"
              style={{ color: on ? "var(--color-ink)" : "color-mix(in srgb, var(--color-ink) 62%, transparent)" }}
            >
              {t.label || `Tab ${i + 1}`}
              {on && (
                <motion.span
                  layoutId="fc-tab-mark"
                  aria-hidden
                  className="absolute inset-x-3 bottom-0 h-[2px]"
                  style={{ background: "var(--color-mark)" }}
                  transition={level === "off" ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
            </button>
          );
        })}
      </div>
      <div
        id={`${group}-panel`}
        role="tabpanel"
        aria-labelledby={`${group}-tab-${active}`}
        className="fc-card mt-4 p-6 md:p-8"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={current.id}
            initial={level === "off" ? false : { opacity: 0, y: 6, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={level === "off" ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="m-0 max-w-[65ch] text-[17px] leading-[1.7] whitespace-pre-line"
          >
            {current.text}
          </motion.p>
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

function StatsView({ block }: { block: StatsBlock }) {
  const items = block.items.filter((s) => s.value.trim());
  return (
    <div className="resume-stats" data-cols={Math.min(4, items.length)} style={{ borderBlock: "1px solid var(--color-divider)" }}>
      {items.map((s) => (
        <div key={s.id} className="flex flex-col gap-1.5 py-7 pr-4">
          <CountUp value={s.value} className="font-heading leading-none" style={{ ...headline("clamp(34px, 4.2vw, 52px)"), color: "var(--color-mark)" }} />
          <span className="text-muted text-[14.5px]">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function ServicesView({ block }: { block: ServicesBlock }) {
  const items = block.items.filter((s) => s.title.trim() || s.text.trim());
  return (
    <ul className="m-0 list-none p-0" style={{ borderTop: "1px solid var(--color-divider)" }}>
      {items.map((s) => (
        <li
          key={s.id}
          className="fc-row grid grid-cols-1 gap-x-10 gap-y-2 py-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(7rem,auto)] md:items-baseline"
          style={{ borderBottom: "1px solid var(--color-divider)" }}
        >
          <span className="font-heading text-[21px] leading-snug">{s.title}</span>
          <span className="text-muted max-w-[60ch] text-[15.5px] leading-[1.65]">{s.text}</span>
          {s.price && (
            <span className="text-[15px] font-semibold whitespace-nowrap tabular-nums md:text-right" style={{ color: "var(--color-mark)" }}>
              {s.price}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function FaqView({ block }: { block: FaqBlock }) {
  const items = block.items.filter((f) => f.question.trim());
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  const level = useMotionLevel();
  const base = useId();
  return (
    <ul className="m-0 list-none p-0" style={{ borderTop: "1px solid var(--color-divider)" }}>
      {items.map((f, i) => {
        const on = open === f.id;
        return (
          <li key={f.id} style={{ borderBottom: "1px solid var(--color-divider)" }}>
            <h5 className="m-0">
              <button
                type="button"
                id={`${base}-q-${i}`}
                aria-expanded={on}
                aria-controls={`${base}-a-${i}`}
                onClick={() => setOpen(on ? null : f.id)}
                className="fc-faq-q flex min-h-[60px] w-full cursor-pointer items-center justify-between gap-6 py-4 text-left text-[17.5px] font-semibold"
              >
                {f.question}
                <span
                  aria-hidden
                  className="grid h-8 w-8 flex-none place-items-center rounded-full transition-transform duration-300"
                  style={{ transform: on ? "rotate(45deg)" : "none", boxShadow: "inset 0 0 0 1px var(--color-divider)", color: "var(--color-mark)" }}
                >
                  <UiIcon id="plus" size={14} />
                </span>
              </button>
            </h5>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div
                  id={`${base}-a-${i}`}
                  role="region"
                  aria-labelledby={`${base}-q-${i}`}
                  initial={level === "off" ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={level === "off" ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: EASE }}
                  className="overflow-hidden"
                >
                  <p className="text-muted m-0 max-w-[65ch] pb-6 text-[16px] leading-[1.7] whitespace-pre-line">{f.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Details, a booking button and a message form. The form composes an email
 * in the visitor's own mail app — this build has no mail service, so it
 * never pretends to have sent anything itself.
 */
function ContactView({ p, section, block }: { p: Portfolio; section: Section; block: ContactBlock }) {
  const privacy = usePublishedPrivacy();
  const handle = usePublishedHandle();
  const record = useRecordClick();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [opened, setOpened] = useState(false);
  const id = useId();
  const firstName = p.header.name.split(" ")[0] || "the owner";
  const showForm = block.form && Boolean(block.email) && privacy.showContact;

  const details = [
    block.email && { icon: "mail", label: block.email, url: `mailto:${block.email}` },
    block.phone && { icon: "phone", label: block.phone, url: `tel:${block.phone.replace(/[^\d+]/g, "")}` },
    block.location && { icon: "pin", label: block.location, url: "" },
  ].filter(Boolean) as Array<{ icon: string; label: string; url: string }>;

  function send(e: React.FormEvent) {
    e.preventDefault();
    const subject = `Hello from ${name.trim() || "your page"}`;
    const body = `${message.trim()}\n\n— ${name.trim()}`;
    record(handle, p.slug, section.id);
    window.location.href = `mailto:${block.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setOpened(true);
  }

  return (
    <div className={`grid grid-cols-1 gap-8 ${showForm ? "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : ""}`}>
      <div className="flex flex-col items-start gap-5">
        {block.text && <p className="m-0 max-w-[48ch] text-[17px] leading-[1.65]">{block.text}</p>}
        {details.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {details.map((d) => (
              <li key={d.icon}>
                {d.url ? (
                  <a
                    href={d.url}
                    onClick={() => record(handle, p.slug, section.id)}
                    className="published-link inline-flex min-h-[40px] items-center gap-3 text-[16px]"
                    style={{ color: "var(--color-mark)" }}
                  >
                    <LinkIcon id={d.icon === "mail" ? "email" : "phone"} size={18} />
                    <span className="published-link-text">{d.label}</span>
                  </a>
                ) : (
                  <span className="inline-flex min-h-[40px] items-center gap-3 text-[16px]">
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" style={{ color: "var(--color-mark)" }}>
                      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
                      <circle cx="12" cy="9.5" r="2.5" />
                    </svg>
                    {d.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {block.ctaUrl && (
          <a
            href={href(block.ctaUrl)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => record(handle, p.slug, section.id)}
            className="btn btn-primary"
          >
            <LinkIcon id={iconFor({ url: block.ctaUrl })} />
            {block.ctaLabel || "Book a time"}
          </a>
        )}
        {!privacy.showContact && (
          <p className="caption-credit m-0">Contact details are hidden. Ask {firstName} for them directly.</p>
        )}
      </div>

      {showForm && (
        <form onSubmit={send} className="fc-card flex flex-col gap-4 p-6 md:p-8">
          <div className="field">
            <label htmlFor={`${id}-name`}>Your name</label>
            <input id={`${id}-name`} className="input" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-message`}>Message</label>
            <textarea
              id={`${id}-message`}
              className="input"
              rows={5}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`What would you like to ask ${firstName}?`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary">
              Write to {firstName}
            </button>
            <span className="text-muted text-[13px]" aria-live="polite">
              {opened ? "Your mail app should have opened with the message ready to send." : "Opens in your own mail app."}
            </span>
          </div>
        </form>
      )}
    </div>
  );
}

/* ── the footer ───────────────────────────────────────────────────────── */

/** The closing line: the author's own, or the theme's fallback. */
export function footerHeadline(p: Portfolio, fallback: string): string {
  return p.footer?.headline?.trim() || fallback;
}

/** The small print: the author's, or a copyright line from the name. */
export function footerNote(p: Portfolio): string {
  return p.footer?.note?.trim() || `© ${new Date().getFullYear()} ${p.header.name}`;
}

/**
 * Everything a footer says under its headline: the line of text, the call
 * to action, the header's links if the author wants them repeated, and the
 * footer's own links. Each theme keeps its own frame around it.
 */
export function FooterBody({ p, center }: { p: Portfolio; center?: boolean }) {
  const f = p.footer;
  const privacy = usePublishedPrivacy();
  const align = center ? "items-center text-center" : "items-start";
  const links = f?.links ?? [];
  return (
    <div className={`flex flex-col gap-6 ${align}`}>
      {f?.text && <p className="text-muted m-0 max-w-[56ch] text-[17px] leading-[1.65]">{f.text}</p>}
      {(f?.ctaUrl || links.length > 0 || f?.showHeaderLinks !== false) && (
        <div className={`flex flex-wrap gap-2 ${center ? "justify-center" : ""}`}>
          {f?.ctaUrl && privacy.showContact && (
            <a href={href(f.ctaUrl)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <LinkIcon id={iconFor({ url: f.ctaUrl })} />
              {f.ctaLabel || "Get in touch"}
            </a>
          )}
          {f?.showHeaderLinks !== false && <HeaderLinks p={p} />}
          {privacy.showContact &&
            links.map((l) => (
              <a key={l.id} href={href(l.url)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                <LinkIcon id={iconFor(l)} />
                {l.label || l.url}
              </a>
            ))}
        </div>
      )}
    </div>
  );
}
