"use client";

import type { Portfolio, Section } from "@/lib/types";
import {
  HeaderLinks,
  Media,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
  allDates,
  allNumbers,
  chaptersOf,
  groundStyle,
  headline,
  usePublishedPrivacy,
} from "../shared";

/**
 * A résumé, first and foremost printable. Rules instead of cards, and every
 * tab rendered as a heading rather than a filter: a CV that showed one section
 * at a time would be a CV with most of itself missing. Résumé therefore
 * ignores `p.layout.roleNav`, as Poster already does.
 *
 * Three things decide the shape, and all three were answers to the same
 * complaint — a narrow column floating on an empty field.
 *
 * **The masthead is full-bleed.** Name, role, summary and the figures band sit
 * on `--color-surface` edge to edge, with only the text inside constrained.
 * A page whose every element stops at the same centred 52rem reads as a
 * document someone forgot to lay out; one band that touches both edges is
 * what makes the rest read as a measure rather than as a shortfall.
 *
 * **The record is two columns, and the rail holds the facts.** Contact and
 * the timeline are reference material — you want them *while* reading an
 * entry, not after the last one — so they sit beside the record and stick.
 * The timeline used to be a full-width block at the very bottom, which is the
 * one place a chronology is no use.
 *
 * **There is no per-entry label.** The old left rail printed `s.tab` against
 * every entry, directly under a chapter heading that had just printed the
 * same string: every entry in a chapter shares its tab by construction, so
 * the column was 132px of restating. The entries start flush against the
 * chapter rule instead, and prose caps at ~68ch so the wider column does not
 * buy unreadable line lengths.
 */
/**
 * How many columns the figures band runs in, for a given number of figures.
 *
 * Four is the widest the band reads at, but five figures in four columns
 * strand the fifth alone on a row that is three-quarters empty. Five and six
 * go in threes instead; seven and eight are back to fours, where the last row
 * is at worst one short.
 */
function statColumns(count: number): number {
  if (count <= 4) return count;
  return count <= 6 ? 3 : 4;
}

export function Resume({ p }: { p: Portfolio }) {
  const chapters = chaptersOf(p);
  // Eight is what the band holds before the figures stop being legible; the
  // shared `StatRow` caps at the same number for the same reason.
  const shownNumbers = allNumbers(p).slice(0, 8);
  const dates = allDates(p);
  const privacy = usePublishedPrivacy();

  // `HeaderLinks` renders either the links or the "contact is hidden" notice,
  // so the block is worth drawing in both of those cases and in neither other.
  const hasContact = !privacy.showContact || p.header.links.length > 0;
  // With nothing to put in it, the rail would be a 240px empty column and the
  // record would read as indented for no reason.
  const hasRail = hasContact || dates.length > 0;

  const shell = "mx-auto w-full max-w-[1160px] px-6 md:px-10 lg:px-12";

  return (
    <div style={groundStyle(p)}>
      <header
        style={{
          background: "var(--color-surface)",
          borderBottom: "2px solid var(--color-divider)",
        }}
      >
        <div className={`${shell} pt-14 pb-12 md:pt-20 md:pb-14`}>
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between sm:gap-12">
            <div className="min-w-0">
              <h1
                className="font-heading m-0 font-extrabold"
                style={{
                  ...headline("clamp(42px, 7vw, 82px)"),
                  lineHeight: 0.9,
                  letterSpacing: "-0.045em",
                }}
              >
                {p.header.name}
              </h1>
              {p.header.current && (
                <p
                  className="m-0 mt-4 max-w-[52ch] text-[17px] leading-[1.45] font-semibold md:text-[19px]"
                  style={{ color: "var(--color-neutral-800)" }}
                >
                  {p.header.current}
                </p>
              )}
            </div>
            {p.header.portrait && (
              <div className="h-[208px] w-[166px] flex-none sm:h-[232px] sm:w-[186px]">
                <Media asset={p.header.portrait} className="h-full w-full" />
              </div>
            )}
          </div>

          {p.header.description && (
            <p
              className="m-0 mt-8 max-w-[62ch] text-[17px] leading-[1.62]"
              style={{ color: "var(--color-neutral-800)" }}
            >
              {p.header.description}
            </p>
          )}

          {shownNumbers.length > 0 && (
            <div
              className="resume-stats mt-12"
              data-cols={statColumns(shownNumbers.length)}
              style={{ borderTop: "2px solid var(--color-divider)" }}
            >
              {shownNumbers.map((n) => (
                <div key={n.id} className="flex flex-col gap-2 pt-7 pr-5 pb-1">
                  <span
                    className="font-heading font-extrabold"
                    style={{
                      ...headline("clamp(30px, 3.6vw, 44px)"),
                      lineHeight: 0.88,
                      letterSpacing: "-0.04em",
                      color: "var(--color-accent)",
                    }}
                  >
                    {n.value}
                  </span>
                  <span className="mono-label">{n.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <div
        className={`${shell} grid gap-x-14 gap-y-12 pt-14 pb-20 md:pt-16 ${
          hasRail ? "lg:grid-cols-[240px_minmax(0,1fr)]" : ""
        }`}
      >
        {hasRail && (
          // `contents` below `lg` drops the wrapper so its two blocks become
          // grid items in their own right and can be ordered around the
          // record — contact above it, the timeline after it. A stacked page
          // that led with four dates would bury the thing it is a CV of.
          <div className="contents lg:sticky lg:top-10 lg:block lg:self-start">
            {hasContact && (
              // The links are `btn-block`, so without a cap they stretch the
              // full page once the rail stacks — a column of 800px buttons
              // under a 13px label.
              <section className="max-lg:order-1 max-lg:max-w-[340px]">
                <h2 className="mono-label m-0 mb-4">Contact</h2>
                <HeaderLinks p={p} block />
              </section>
            )}
            {dates.length > 0 && (
              // Capped for the same reason, so the stacked rules do not run
              // the width of the page under two words and a year.
              <section className="max-lg:order-3 max-lg:max-w-[420px] lg:mt-10">
                <h2 className="mono-label m-0 mb-4">Timeline</h2>
                <ol className="m-0 list-none p-0">
                  {dates.map((d) => (
                    <li
                      key={d.id}
                      className="resume-entry flex flex-col gap-1 py-3.5"
                      style={{ borderTop: "1px solid var(--color-divider)" }}
                    >
                      <span
                        className="font-heading text-[15px] font-extrabold"
                        style={{ letterSpacing: "-0.01em", color: "var(--color-accent)" }}
                      >
                        {d.year}
                      </span>
                      <span
                        className="text-[14px] leading-[1.45]"
                        style={{ color: "var(--color-neutral-800)" }}
                      >
                        {d.text}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}

        <main className="min-w-0 max-lg:order-2">
          {chapters.map((c, i) => (
            <section key={c.tab} className={i > 0 ? "mt-14" : ""}>
              <h2
                className="font-heading m-0 pb-3 text-[13px] font-extrabold tracking-[0.16em] uppercase"
                style={{
                  color: "var(--color-accent)",
                  borderBottom: "2px solid var(--color-divider)",
                }}
              >
                {c.tab}
              </h2>
              {c.sections.map((s) => (
                <Entry key={s.id} p={p} section={s} />
              ))}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}

/**
 * One entry in the record.
 *
 * The image gets its own column rather than running full width: the prose is
 * capped at a measure, and an uncapped photograph beside it is what fills the
 * space that cap leaves over. Entries without one keep the same flush-left
 * text edge, which is the thing that makes a column of them scan as a record.
 */
function Entry({ p, section }: { p: Portfolio; section: Section }) {
  return (
    <article
      className={`resume-entry grid gap-x-8 gap-y-5 py-8 ${
        section.image ? "sm:grid-cols-[minmax(0,1fr)_180px]" : ""
      }`}
      style={{ borderBottom: "1px solid var(--color-divider)" }}
    >
      <div className="flex min-w-0 flex-col items-start gap-3">
        <SectionTitleLink
          p={p}
          section={section}
          className="font-heading text-[22px] leading-[1.15] font-extrabold tracking-[-0.025em] hover:underline md:text-[25px]"
        />
        {section.description && (
          <p
            className="m-0 max-w-[68ch] text-[16px] leading-[1.62]"
            style={{ color: "var(--color-neutral-800)" }}
          >
            {section.description}
          </p>
        )}
        <SectionAside p={p} section={section} />
        <SectionLinks p={p} section={section} />
      </div>
      {section.image && (
        <Media asset={section.image} className="h-[150px] w-full sm:h-[128px]" />
      )}
    </article>
  );
}
