"use client";

import type { Portfolio } from "@/lib/types";
import {
  Media,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
  StatRow,
  Tabs,
  allDates,
  groundStyle,
  headline,
  tabs,
  useTabFilter,
} from "../shared";

/* ── 1c Poster — an accent field hero over a numbered record ─────────── */

export function Poster({ p }: { p: Portfolio }) {
  const { tab, setTab, shown } = useTabFilter(p);
  const dates = allDates(p);

  return (
    <div style={groundStyle(p)}>
      <div
        className="px-6 pt-14 md:px-11"
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      >
        {p.header.current && (
          <div className="mono-label mb-12" style={{ color: "inherit" }}>
            {p.header.current}
          </div>
        )}

        {/* One word per line, and the size floors at 3rem rather than
            scaling to nothing: a name set at 10vw on a 390px screen came out
            at 39px, which is a subheading, not a poster. */}
        <h1
          className="m-0 mb-11 font-extrabold"
          style={{
            ...headline("clamp(3.5rem, 13vw, 11.75rem)"),
            lineHeight: 0.82,
            letterSpacing: "-0.055em",
          }}
        >
          {p.header.name.split(" ").map((w, i) => (
            <span key={`${w}-${i}`} className="block">
              {w}
            </span>
          ))}
        </h1>
        <p
          className="m-0 mb-16 max-w-[30ch] font-medium"
          style={{ ...headline("27px"), lineHeight: 1.35 }}
        >
          {p.header.description}
        </p>

        {/* -mx cancels the field's own padding so the tab strip runs to the
            edge of the accent, which is what makes it read as part of it. */}
        <div className="-mx-6 flex flex-wrap gap-0.5 px-6 md:-mx-11 md:px-11">
          <Tabs p={p} tab={tab} setTab={setTab} variant="block" />
        </div>
      </div>

      <StatRow p={p} big onAccent />

      <div className="grid gap-16 px-6 py-20 md:grid-cols-[minmax(200px,268px)_1fr] md:px-10">
        <nav className="md:sticky md:top-8 md:self-start">
          <h6 className="mb-6">Index</h6>
          <ol className="m-0 list-none p-0">
            {tabs(p).map((t, i) => (
              <li key={t} style={{ borderBottom: "1px solid var(--color-divider)" }}>
                <button
                  type="button"
                  onClick={() => setTab(t)}
                  className="font-heading flex min-h-[56px] w-full cursor-pointer items-baseline gap-4 py-4 text-left text-[22px] font-extrabold"
                  style={{
                    color: t === tab ? "var(--color-accent)" : "var(--color-neutral-800)",
                    letterSpacing: "-0.02em",
                    transition: "color 160ms var(--ease-out)",
                  }}
                >
                  <span className="mono-label flex-none">{String(i + 1).padStart(2, "0")}</span>
                  <span>{t}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div>
          {shown.map((s) => (
            <article
              key={s.id}
              className="flex gap-9 py-11 first:pt-0"
              style={{ borderBottom: "1px solid var(--color-divider)" }}
            >
              {/* A section's own image, as a thumbnail down the left: the
                  entry is a résumé line now, and an author who uploaded a
                  picture must not find it silently dropped. Only drawn when
                  there is one — no hatched placeholder in a list. */}
              {s.image && (
                <div className="h-[110px] w-[110px] flex-none sm:h-[210px] sm:w-[168px]">
                  <Media asset={s.image} className="h-full w-full" />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col items-start gap-3.5">
                <SectionTitleLink
                  p={p}
                  section={s}
                  className="font-heading text-[30px] leading-[1.02] font-extrabold tracking-[-0.035em] hover:underline md:text-[40px]"
                />
                <p
                  className="m-0 max-w-[58ch] text-[17px] leading-[1.6]"
                  style={{ color: "var(--color-neutral-800)" }}
                >
                  {s.description}
                </p>
                <SectionAside p={p} section={s} />
                <SectionLinks p={p} section={s} />
              </div>
            </article>
          ))}
        </div>
      </div>

      {dates.length > 0 && (
        <div
          className="px-6 py-20 md:px-10"
          style={{ borderTop: "2px solid var(--color-divider)" }}
        >
          <h6 className="m-0 mb-8">Timeline</h6>
          <div>
            {dates.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-baseline gap-x-8 gap-y-1 py-6"
                style={{ borderBottom: "1px solid var(--color-divider)" }}
              >
                <span
                  className="font-heading w-24 flex-none text-3xl font-extrabold"
                  style={{ letterSpacing: "-0.03em", color: "var(--color-accent)" }}
                >
                  {d.year}
                </span>
                <span className="flex-1 text-lg leading-[1.5]">{d.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
