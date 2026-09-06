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
  gridCols,
  groundStyle,
  headline,
  pad,
  useTabFilter,
} from "../shared";

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

