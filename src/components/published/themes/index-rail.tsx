"use client";

import type { Portfolio } from "@/lib/types";
import {
  HeaderLinks,
  Kicker,
  Media,
  SectionTitleLink,
  StatRow,
  groundStyle,
  headline,
  tabs,
  useTabFilter,
  visibleSections,
} from "../shared";

export function IndexRail({ p }: { p: Portfolio }) {
  const { tab, setTab, shown } = useTabFilter(p);
  const all = tabs(p);

  return (
    <div style={groundStyle(p)}>

      <div className="grid md:grid-cols-[300px_1fr]">
        <div
          className="p-6 md:p-8"
          style={{
            background: "var(--color-surface)",
            borderRight: "2px solid var(--color-divider)",
          }}
        >
          <div
            className="mb-4 h-[120px] w-[120px]"
          >
            <Media asset={p.header.portrait} className="h-full w-full" />
          </div>
          <h2 className="mb-1.5" style={headline("30px")}>{p.header.name}</h2>
          <p className="mb-5 text-[13px]" style={{ color: "var(--color-neutral-700)" }}>
            {p.header.current}
          </p>

          <div style={{ borderTop: "2px solid var(--color-divider)" }}>
            {all.map((t, i) => {
              const on = t === tab;
              const count = visibleSections(p).filter((s) => s.tab === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="flex w-full cursor-pointer items-center gap-3 py-2.5 text-left text-sm"
                  style={{
                    borderBottom: "1px solid var(--color-divider)",
                    color: on ? "var(--color-accent)" : "inherit",
                    fontWeight: on ? 800 : 400,
                  }}
                >
                  <span className="font-heading text-[11px] font-extrabold opacity-55">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{t}</span>
                  <span className="ml-auto text-[11px] opacity-55">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <HeaderLinks p={p} block />
          </div>
        </div>

        <div>
          <div
            className="px-6 pb-6 pt-8 md:px-9"
            style={{ borderBottom: "2px solid var(--color-divider)" }}
          >
            <Kicker>{tab}</Kicker>
            <p className="m-0 max-w-[60ch] text-[19px]">{p.header.description}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>#</th>
                  <th>Work</th>
                  <th style={{ width: 150 }}>Tab</th>
                  <th style={{ width: 210 }}>Links</th>
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
                      <div
                        className="text-xs"
                        style={{ color: "var(--color-neutral-700)" }}
                      >
                        {s.description}
                      </div>
                    </td>
                    <td>
                      <span className="tag tag-neutral">{s.tab}</span>
                    </td>
                    <td className="text-[13px]">
                      {s.links.map((l) => l.label).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <StatRow p={p} />
        </div>
      </div>
    </div>
  );
}

/* ── 1c Poster — accent field hero, tabs as a statement ───────────────── */

