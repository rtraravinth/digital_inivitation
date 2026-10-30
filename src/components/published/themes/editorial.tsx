"use client";

import { AnimatePresence, LayoutGroup } from "motion/react";
import { LinkIcon, iconFor } from "@/lib/icons";
import type { Portfolio, Section } from "@/lib/types";
import { pageAddress } from "@/lib/types";
import {
  LensGate,
  Media,
  PlateCaption,
  PlateLeaf,
  PlateTurn,
  SectionAside,
  SectionLinks,
  StatRow,
  Tabs,
  allDates,
  allNumbers,
  gridCols,
  groundStyle,
  headline,
  href,
  pad,
  tabs,
  useTabFilter,
  usePublishedHandle,
  usePublishedPrivacy,
  visibleSections,
} from "../shared";

/* ── 1a Editorial — the catalogue proper ──────────────────────────────────
   Plates in a run down the board, each one mounted and trimmed, each caption
   set on the board beneath its plate rather than inside a box with it. The
   plate list runs the right margin and is numbered, because the sequence is
   what a visitor cites.
   ────────────────────────────────────────────────────────────────────── */

/**
 * One plate and its caption.
 *
 * Not a card. The old card ruled its own top edge and held the image, the
 * title and the body inside one container, which is the lazy structure this
 * world refuses: here the plate is the object and the caption is apparatus
 * sitting next to it on the board.
 *
 * **A section with no image still gets a plate.** It used to get a hairline
 * and a 21px caption, which left the opening entry as several hundred pixels
 * of nothing — the fix for an over-large ruled blank had removed the mount
 * instead of filling it. A catalogue sets the work's own title on the mount
 * where no reproduction exists, so that is what this draws: the title at
 * display scale on the plate, the caption still on the board beneath it.
 */
function PlateEntry({
  p,
  section,
  index,
  lead,
}: {
  p: Portfolio;
  section: Section;
  index: number;
  /** The first plate on the page, which carries the primary action. */
  lead?: boolean;
}) {
  const cta = p.header.links[0];
  const showContact = usePublishedPrivacy().showContact;
  return (
    <PlateLeaf className={`m-0 flex flex-col items-stretch gap-5 ${pad(p).card}`}>
      {section.image ? (
        <Media
          asset={section.image}
          className="aspect-[4/3] max-h-[560px] w-full"
          caption={`plate ${String(index).padStart(2, "0")}`}
          layoutId={`plate-${section.id}`}
          tilt
        />
      ) : (
        <Media
          asset={null}
          // No aspect ratio here. A reproduction's mount is the shape of the
          // reproduction; a title mount is the shape of the title, so it is
          // sized by its own block with a floor that keeps it reading as a
          // plate. At full column width a 4:3 box put the title in the
          // bottom tenth of an otherwise empty sheet — the ruled blank
          // coming back in through the fix meant to retire it.
          className="flex min-h-[240px] w-full items-end"
          layoutId={`plate-${section.id}`}
          tilt
        >
          {/* Type set on the mount, which is what a catalogue prints when the
              plate itself is not reproduced. */}
          <div className="flex w-full flex-col justify-end p-7 md:p-9">
            <span
              className="font-heading block"
              style={{
                ...headline("clamp(30px, 3.4vw, 50px)"),
                lineHeight: 1.02,
                letterSpacing: "-0.02em",
              }}
            >
              {section.title}
            </span>
          </div>
        </Media>
      )}
      <PlateCaption
        p={p}
        section={section}
        index={index}
        titleOnPlate={!section.image}
      >
        <div className="mt-1 flex flex-col items-start gap-4">
          <SectionAside p={p} section={section} />
          <SectionLinks p={p} section={section} />
          {/* The page's primary action lives in the first plate's caption,
              in the cloth, rather than floating in a band at the bottom. */}
          {lead && cta && showContact && (
            <a
              href={href(cta.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary mt-1 min-h-[46px]"
            >
              <LinkIcon id={iconFor(cta)} size={17} />
              {cta.label}
            </a>
          )}
        </div>
      </PlateCaption>
    </PlateLeaf>
  );
}

export function Editorial({ p }: { p: Portfolio }) {
  const handle = usePublishedHandle();
  const { tab, setTab, shown, nav, chapters, gated } = useTabFilter(p);
  const numbers = allNumbers(p);
  const dates = allDates(p);
  const railTabs = tabs(p);

  if (gated) {
    return (
      <div style={groundStyle(p)}>
        <LensGate p={p} setTab={setTab} />
      </div>
    );
  }

  // Plate numbers run the whole page, not the open tab, so a plate keeps its
  // number whichever room you read it in — which is the point of numbering it.
  const all = visibleSections(p);
  const plateNo = (s: Section) => all.indexOf(s) + 1;

  const plates = (
    // One plate in the room spans the run. Left in its single track it sat
    // against several hundred pixels of empty second column — a grid is a
    // grid only once there is something to align.
    <div
      className={`grid gap-x-12 gap-y-20 px-6 py-16 md:px-10 ${
        shown.length > 1 ? gridCols(p) : ""
      }`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {shown.map((s, i) => (
          <PlateEntry key={s.id} p={p} section={s} index={plateNo(s)} lead={i === 0} />
        ))}
      </AnimatePresence>
    </div>
  );

  /**
   * The plate list, set down the right margin.
   *
   * This is the page's only route, so it holds the margin on every layout
   * wide enough to have one. Below `lg` there is no margin to hold, and it
   * becomes the ruled strip under the half-title instead.
   */
  const plateList = (
    <nav
      aria-label="Plate list"
      className="px-6 py-16 md:px-10 lg:sticky lg:top-8 lg:self-start lg:px-0 lg:pr-10 lg:pl-10"
      style={{ borderLeft: "1px solid var(--color-divider)" }}
    >
      <h6 className="mb-5 text-muted">Plate list</h6>
      <ol className="m-0 list-none p-0">
        {railTabs.map((t, i) => {
          const on = t === tab;
          const count = all.filter((s) => s.tab === t).length;
          return (
            <li key={t} style={{ borderBottom: "1px solid var(--color-divider)" }}>
              <button
                type="button"
                onClick={() => setTab(t)}
                aria-current={on ? "true" : undefined}
                className="flex min-h-[54px] w-full cursor-pointer items-baseline gap-3.5 py-3 text-left"
                style={{
                  color: on ? "var(--color-mark)" : undefined,
                  opacity: on ? 1 : 0.66,
                  transition:
                    "color 180ms var(--ease-out), opacity 180ms var(--ease-out)",
                }}
              >
                <span className="plate-no text-[12px]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-heading text-[19px] leading-tight">{t}</span>
                <span className="caption-credit ml-auto" style={{ color: "inherit" }}>
                  {count}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  const measurements = numbers.length > 0 && (
    <section
      className="px-6 py-16 md:px-10"
      style={{ borderTop: "1px solid var(--color-ink)" }}
    >
      <h6 className="mb-8 text-muted">Measurements</h6>
      {/* Five figures across four columns leave the fifth alone on a
          three-quarters-empty row, so five and six run in threes — the same
          answer `statColumns()` reaches on the checklist. */}
      <div
        className={`grid grid-cols-2 gap-x-10 gap-y-8 ${
          numbers.length === 5 || numbers.length === 6 ? "md:grid-cols-3" : "md:grid-cols-4"
        }`}
      >
        {numbers.map((n) => (
          <div
            key={n.id}
            className="flex flex-col gap-1.5 pt-5"
            style={{ borderTop: "1px solid var(--color-divider)" }}
          >
            <div
              className="font-heading figure"
              style={{
                ...headline("40px"),
                lineHeight: 0.92,
                letterSpacing: "-0.02em",
              }}
            >
              {n.value}
            </div>
            <div className="mono-label">{n.label}</div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div style={groundStyle(p)}>
      {/* ── the half-title ──────────────────────────────────────────────
          The name alone at architectural scale, the current role set small
          beneath it, and a hairline closing the band. Nothing else is in it:
          the description and the classification line read below the rule,
          where they do not compete with the name or push the first plate out
          of the opening viewport. No eyebrow above the name either — the
          name carries its own weight.
          ──────────────────────────────────────────────────────────────── */}
      <div
        className="grid gap-14 px-6 pt-20 pb-12 md:grid-cols-[1fr_380px] md:items-end md:px-10 md:pt-28"
        style={{ borderBottom: "1px solid var(--color-ink)" }}
      >
        <div className="flex flex-col items-start">
          <h1
            className="m-0 leading-[0.88]"
            style={{
              ...headline("clamp(54px, 9vw, 116px)"),
              letterSpacing: "-0.03em",
            }}
          >
            {p.header.name}
          </h1>
          {p.header.current && (
            <p className="caption-credit mt-6 mb-0 max-w-[52ch]">{p.header.current}</p>
          )}
        </div>
        {/* The frontispiece: a portrait mounted like any other plate, at
            96px square on a phone where the half-title needs the room.
            Drawn only when there is one — an empty mount at this scale is
            half the opening viewport spent on a ruled blank. */}
        {p.header.portrait && (
          <figure className="m-0 h-24 w-24 md:h-[340px] md:w-auto">
            <Media
              asset={p.header.portrait}
              className="h-full w-full"
              caption="frontispiece"
              tilt
            />
          </figure>
        )}
      </div>

      {/* Below the rule: the statement and the classification line. */}
      <div className="flex flex-col items-start gap-7 px-6 py-10 md:px-10">
        <p className="m-0 max-w-[52ch] text-[19px] leading-[1.55] text-muted">
          {p.header.description}
        </p>
        {/* The tags are the catalogue's classification line: set as words on
            a hairline, not as filled chips, and deliberately not marked in
            colour — a coloured first word directly above the plate list read
            as a second, selected navigation. */}
        {p.header.tags.length > 0 && (
          <div className="flex flex-wrap gap-x-7 gap-y-3">
            {p.header.tags.map((t) => (
              <span
                key={t}
                className="caption-credit pb-1.5"
                style={{ borderBottom: "1px solid var(--color-divider)" }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Below `lg` the plate list has no margin to live in, so it rules a
          strip here instead. `lg:hidden` rather than a second component: one
          `Tabs` call, two placements. */}
      {nav !== "scroll" && (
        <div
          className="flex gap-9 overflow-x-auto px-6 md:px-10 lg:hidden"
          style={{
            borderTop: "1px solid var(--color-ink)",
            borderBottom: "1px solid var(--color-divider)",
          }}
        >
          <Tabs p={p} tab={tab} setTab={setTab} variant="underline" />
        </div>
      )}

      <LayoutGroup>
        <div
          className={`grid items-start ${
            nav === "rail"
              ? "lg:grid-cols-[250px_1fr]"
              : nav === "scroll"
                ? ""
                : "lg:grid-cols-[1fr_300px]"
          }`}
          style={{ borderTop: "1px solid var(--color-ink)" }}
        >
          {nav === "rail" && (
            <nav
              aria-label="Plate list"
              className="px-6 py-10 md:pl-10"
              style={{ borderRight: "1px solid var(--color-divider)" }}
            >
              <h6 className="mb-5 text-muted">Plate list</h6>
              {railTabs.map((t, i) => {
                const on = t === tab;
                const count = all.filter((s) => s.tab === t).length;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    aria-current={on ? "true" : undefined}
                    className="flex min-h-[54px] w-full cursor-pointer items-baseline gap-3.5 py-3 text-left text-[16px]"
                    style={{
                      borderBottom: "1px solid var(--color-divider)",
                      color: on ? "var(--color-mark)" : undefined,
                      opacity: on ? 1 : 0.68,
                      transition:
                        "color 180ms var(--ease-out), opacity 180ms var(--ease-out)",
                    }}
                  >
                    <span className="plate-no text-[12px]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-heading text-[19px]">{t}</span>
                    <span className="caption-credit ml-auto" style={{ color: "inherit" }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

          {nav === "scroll" ? (
            <div>
              {chapters.map((c) => (
                <section key={c.tab}>
                  <div
                    className="flex items-baseline gap-3.5 px-6 py-4 md:px-10"
                    style={{
                      borderTop: "1px solid var(--color-ink)",
                      borderBottom: "1px solid var(--color-divider)",
                    }}
                  >
                    <span
                      className="plate-no text-[12px]"
                      style={{ color: "var(--color-mark)" }}
                    >
                      {String(chapters.indexOf(c) + 1).padStart(2, "0")}
                    </span>
                    <h6 className="m-0">{c.tab}</h6>
                  </div>
                  <div className={`grid gap-x-12 gap-y-20 px-6 py-16 md:px-10 ${gridCols(p)}`}>
                    {c.sections.map((s, i) => (
                      <PlateEntry
                        key={s.id}
                        p={p}
                        section={s}
                        index={plateNo(s)}
                        lead={chapters.indexOf(c) === 0 && i === 0}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            // The plate turn. The container persists and each plate carries
            // its own `layoutId`, so a plate in both the old room and the new
            // one travels to its new box with its caption rather than the
            // whole stack being swapped out.
            <PlateTurn>{plates}</PlateTurn>
          )}

          {/* The plate list holds the right margin on wide layouts — it is
              the page's only route, and the margin is where a catalogue puts
              the list of what is in it. */}
          {nav !== "rail" && nav !== "scroll" && (
            <div className="hidden lg:block">{plateList}</div>
          )}
        </div>
      </LayoutGroup>

      {measurements}

      {/* The plate list took the column the figures band would have used. */}
      {numbers.length > 0 && nav === "rail" && <StatRow p={p} />}

      {dates.length > 0 && (
        <section
          className="px-6 py-16 md:px-10 md:py-20"
          style={{ borderTop: "1px solid var(--color-ink)" }}
        >
          <h6 className="mb-9 text-muted">Chronology</h6>
          <div className="grid grid-cols-2 gap-x-10 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {dates.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-2.5 pt-5"
                style={{ borderTop: "1px solid var(--color-divider)" }}
              >
                <div
                  className="font-heading figure text-[30px] leading-none"
                  style={{ letterSpacing: "-0.015em", color: "var(--color-mark)" }}
                >
                  {e.year}
                </div>
                <div className="text-[15px] leading-[1.5]">{e.text}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── the colophon ────────────────────────────────────────────────
          Where a catalogue states what it is. Every line is read off the
          page itself, so it tells the truth on whoever's page it ships on.

          Set on the board under a hairline rather than on a full-bleed
          accent field: that band was Modernist's closing banner carried
          over, and the page's primary action now sits in the first plate's
          caption where a reader meets it.
          ──────────────────────────────────────────────────────────────── */}
      <footer
        className="flex flex-wrap items-baseline gap-x-8 gap-y-3 px-6 py-12 md:px-10"
        style={{ borderTop: "1px solid var(--color-ink)" }}
      >
        <span className="font-heading text-[22px]">{p.header.name}</span>
        <span className="caption-credit">
          {all.length} {all.length === 1 ? "plate" : "plates"} · {railTabs.length}{" "}
          {railTabs.length === 1 ? "room" : "rooms"}
        </span>
        <span className="caption-credit ml-auto">{pageAddress(handle, p.slug)}</span>
      </footer>
    </div>
  );
}
