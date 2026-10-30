"use client";

import { AnimatePresence } from "motion/react";
import type { Portfolio, Section } from "@/lib/types";
import {
  Media,
  PlateLeaf,
  PlateTurn,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
  StatRow,
  Tabs,
  allDates,
  captionCredit,
  groundStyle,
  headline,
  tabs,
  useTabFilter,
  visibleSections,
} from "../shared";

/* ── 1c Poster — the jacket ───────────────────────────────────────────────
   A monograph's dust jacket: the name set across the cloth at full bleed,
   the measurements struck into the band below it, and the record of plates
   indexed down the left of the pages that follow.
   ────────────────────────────────────────────────────────────────────── */

export function Poster({ p }: { p: Portfolio }) {
  const { tab, setTab, shown } = useTabFilter(p);
  const dates = allDates(p);
  const all = visibleSections(p);
  const plateNo = (s: Section) => all.indexOf(s) + 1;

  return (
    <div style={groundStyle(p)}>
      {/* The cloth. Every colour on it is drawn from `--color-accent-ink`, so
          a pale accent gets dark lettering rather than white on white. */}
      <div
        className="px-6 pt-14 md:px-11"
        style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
      >
        {/* One word per line, and the size floors at 3.5rem rather than
            scaling to nothing: a name set at 10vw on a 390px screen came out
            at 39px, which is a subheading, not a jacket. */}
        <h1
          className="m-0 mb-10"
          style={{
            ...headline("clamp(3.5rem, 13vw, 11.5rem)"),
            lineHeight: 0.84,
            letterSpacing: "-0.035em",
          }}
        >
          {p.header.name.split(" ").map((w, i) => (
            <span key={`${w}-${i}`} className="block">
              {w}
            </span>
          ))}
        </h1>
        {p.header.current && (
          <div className="caption-credit mb-7" style={{ color: "inherit", opacity: 0.88 }}>
            {p.header.current}
          </div>
        )}
        <p
          className="font-heading m-0 mb-16 max-w-[32ch]"
          style={{ ...headline("26px"), lineHeight: 1.32 }}
        >
          {p.header.description}
        </p>

        {/* -mx cancels the cloth's own padding so the plate list runs to the
            edge of the field, which is what makes it read as part of it. */}
        <div className="-mx-6 flex flex-wrap gap-0.5 px-6 md:-mx-11 md:px-11">
          <Tabs p={p} tab={tab} setTab={setTab} variant="block" />
        </div>
      </div>

      <StatRow p={p} big onAccent />

      <div className="grid gap-16 px-6 py-20 md:grid-cols-[minmax(200px,272px)_1fr] md:px-10">
        <nav aria-label="Plate list" className="md:sticky md:top-8 md:self-start">
          <h6 className="mb-6 text-muted">Plate list</h6>
          <ol className="m-0 list-none p-0">
            {tabs(p).map((t, i) => {
              const on = t === tab;
              return (
                <li key={t} style={{ borderBottom: "1px solid var(--color-divider)" }}>
                  <button
                    type="button"
                    onClick={() => setTab(t)}
                    aria-current={on ? "true" : undefined}
                    className="font-heading flex min-h-[58px] w-full cursor-pointer items-baseline gap-4 py-4 text-left text-[23px]"
                    style={{
                      color: on ? "var(--color-mark)" : undefined,
                      opacity: on ? 1 : 0.66,
                      letterSpacing: "-0.015em",
                      transition:
                        "color 180ms var(--ease-out), opacity 180ms var(--ease-out)",
                    }}
                  >
                    <span className="plate-no flex-none text-[13px]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{t}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <PlateTurn>
          <AnimatePresence mode="popLayout" initial={false}>
          {shown.map((s) => {
            const [, medium, credit] = captionCredit(s);
            return (
              <PlateLeaf
                key={s.id}
                className="m-0 flex gap-9 py-11 first:pt-0"
              >
                {/* A section's own image, mounted small down the left: the
                    entry is a record line, and an author who uploaded a
                    picture must not find it silently dropped. Only drawn when
                    there is one — a list prints no ruled blank. */}
                {s.image && (
                  <div className="h-[110px] w-[110px] flex-none sm:h-[210px] sm:w-[168px]">
                    <Media asset={s.image} className="h-full w-full" />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col items-start gap-3.5">
                  <div className="flex items-baseline gap-4">
                    <span
                      className="plate-no flex-none text-[14px]"
                      style={{ color: "var(--color-mark)" }}
                    >
                      {String(plateNo(s)).padStart(2, "0")}
                    </span>
                    <SectionTitleLink
                      p={p}
                      section={s}
                      className="font-heading text-[30px] leading-[1.04] tracking-[-0.02em] hover:underline md:text-[40px]"
                    />
                  </div>
                  <div className="caption-credit">
                    {medium} · {credit}
                  </div>
                  <p className="m-0 max-w-[58ch] text-[16px] leading-[1.6] text-muted">
                    {s.description}
                  </p>
                  <SectionAside p={p} section={s} />
                  <SectionLinks p={p} section={s} />
                </div>
              </PlateLeaf>
            );
          })}
          </AnimatePresence>
        </PlateTurn>
      </div>

      {dates.length > 0 && (
        <section
          className="px-6 py-20 md:px-10"
          style={{ borderTop: "1px solid var(--color-ink)" }}
        >
          <h6 className="m-0 mb-8 text-muted">Chronology</h6>
          <div>
            {dates.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-baseline gap-x-8 gap-y-1 py-6"
                style={{ borderBottom: "1px solid var(--color-divider)" }}
              >
                <span
                  className="font-heading figure w-24 flex-none text-[30px]"
                  style={{ letterSpacing: "-0.015em", color: "var(--color-mark)" }}
                >
                  {d.year}
                </span>
                <span className="flex-1 text-[17px] leading-[1.5]">{d.text}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
