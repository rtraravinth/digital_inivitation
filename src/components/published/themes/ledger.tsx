"use client";

import type { Portfolio } from "@/lib/types";
import {
  LensGate,
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

