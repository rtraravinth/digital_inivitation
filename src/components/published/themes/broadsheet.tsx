"use client";

import type { Portfolio } from "@/lib/types";
import {
  LensGate,
  Media,
  SectionLinks,
  SectionTitleLink,
  StatRow,
  Tabs,
  allDates,
  groundStyle,
  headline,
  pad,
  useTabFilter,
} from "../shared";

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

