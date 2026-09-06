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
        className="px-6 pt-8 md:px-11 md:pt-11"
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      >

        <h1
          className="m-0 mb-5 font-extrabold leading-[0.9]"
          style={{ ...headline("clamp(3rem, 10vw, 9rem)"), letterSpacing: "-0.04em" }}
        >
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

      <div className="grid gap-10 px-6 py-12 md:grid-cols-[minmax(180px,240px)_1fr] md:px-10">
        <nav className="md:sticky md:top-6 md:self-start">
          <ol className="m-0 list-none p-0">
            {tabs(p).map((t, i) => (
              <li key={t} style={{ borderBottom: "1px solid var(--color-divider)" }}>
                <button
                  type="button"
                  onClick={() => setTab(t)}
                  className="font-heading flex w-full cursor-pointer items-baseline gap-3 py-3 text-left font-extrabold"
                  style={{
                    color: t === tab ? "var(--color-accent)" : "inherit",
                    fontSize: 20,
                  }}
                >
                  <span className="mono-label flex-none">{String(i + 1).padStart(2, "0")}</span>
                  <span>{t}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div style={{ borderTop: "1px solid var(--color-divider)" }}>
          {shown.map((s) => (
            <article
              key={s.id}
              className="flex gap-5 py-6"
              style={{ borderBottom: "1px solid var(--color-divider)" }}
            >
              {/* A section's own image, as a thumbnail down the left: the
                  entry is a résumé line now, and an author who uploaded a
                  picture must not find it silently dropped. Only drawn when
                  there is one — no hatched placeholder in a list. */}
              {s.image && (
                <div className="h-[88px] w-[88px] flex-none sm:h-[120px] sm:w-[120px]">
                  <Media asset={s.image} className="h-full w-full" />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <SectionTitleLink
                  p={p}
                  section={s}
                  className="font-heading text-[24px] font-extrabold leading-tight hover:underline"
                />
                <p className="m-0 mt-2 text-sm leading-relaxed opacity-80">{s.description}</p>
                <SectionAside p={p} section={s} />
                <div className="mt-2">
                  <SectionLinks p={p} section={s} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {dates.length > 0 && (
        <div
          className="px-6 py-12 md:px-10"
          style={{ borderTop: "2px solid var(--color-divider)" }}
        >
          <h2 className="mono-label m-0 mb-6">Timeline</h2>
          <div>
            {dates.map((d, i) => (
              <div
                key={d.id}
                className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-4"
                style={{ borderBottom: "1px solid var(--color-divider)" }}
              >
                <span className="mono-label w-8 flex-none">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-heading w-16 flex-none text-lg font-extrabold">
                  {d.year}
                </span>
                <span className="flex-1 text-sm leading-relaxed opacity-80">{d.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
