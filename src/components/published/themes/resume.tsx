"use client";

import type { Portfolio } from "@/lib/types";
import {
  HeaderLinks,
  Media,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
  allDates,
  allNumbers,
  groundStyle,
  headline,
  tabs,
  visibleSections,
} from "../shared";

/**
 * A resume, first and foremost printable. One column, rules instead of
 * cards, and every tab rendered as a heading rather than a filter: a CV that
 * showed one section at a time would be a CV with most of itself missing.
 * Resume therefore ignores `p.layout.roleNav`, as Poster already does.
 */
export function Resume({ p }: { p: Portfolio }) {
  const all = visibleSections(p);
  const chapters = tabs(p)
    .map((tab) => ({ tab, sections: all.filter((s) => s.tab === tab) }))
    .filter((c) => c.sections.length > 0);
  const numbers = allNumbers(p);
  const dates = allDates(p);

  return (
    <div style={groundStyle(p)}>
      <div className="resume-page mx-auto w-full max-w-[46rem] px-6 py-10 md:px-10">
        <header className="pb-6" style={{ borderBottom: "2px solid var(--color-divider)" }}>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1
                className="font-heading m-0 font-extrabold leading-none"
                style={headline("44px")}
              >
                {p.header.name}
              </h1>
              {p.header.current && (
                <p
                  className="m-0 mt-2 text-[15px]"
                  style={{ color: "var(--color-neutral-800)" }}
                >
                  {p.header.current}
                </p>
              )}
            </div>
            {p.header.portrait && (
              <div className="h-[96px] w-[96px] flex-none">
                <Media asset={p.header.portrait} className="h-full w-full" />
              </div>
            )}
          </div>
          {p.header.description && (
            <p className="m-0 mt-4 text-sm leading-relaxed opacity-80">
              {p.header.description}
            </p>
          )}
          <div className="mt-4">
            <HeaderLinks p={p} inline />
          </div>
        </header>

        {numbers.length > 0 && (
          <div className="flex flex-wrap py-4" style={{ borderBottom: "1px solid var(--color-divider)" }}>
            {numbers.slice(0, 8).map((n) => (
              <div key={n.id} className="pr-8 last:pr-0">
                <span className="font-heading text-[17px] font-extrabold">{n.value}</span>{" "}
                <span className="text-[13px]" style={{ color: "var(--color-neutral-700)" }}>
                  {n.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {chapters.map((c) => (
          <section key={c.tab} className="pt-8">
            <h2
              className="font-heading m-0 pb-2 text-[13px] font-extrabold uppercase tracking-[0.12em]"
              style={{
                color: "var(--color-accent)",
                borderBottom: "2px solid var(--color-divider)",
              }}
            >
              {c.tab}
            </h2>
            {c.sections.map((s) => (
              <article
                key={s.id}
                className="resume-entry py-5"
                style={{ borderBottom: "1px solid var(--color-divider)" }}
              >
                <SectionTitleLink
                  p={p}
                  section={s}
                  className="font-heading text-[18px] font-extrabold leading-tight hover:underline"
                />
                {s.description && (
                  <p className="m-0 mt-1.5 text-sm leading-relaxed opacity-80">
                    {s.description}
                  </p>
                )}
                <SectionAside p={p} section={s} />
                <div className="mt-2">
                  <SectionLinks p={p} section={s} />
                </div>
              </article>
            ))}
          </section>
        ))}

        {dates.length > 0 && (
          <section className="pt-8">
            <h2
              className="font-heading m-0 pb-2 text-[13px] font-extrabold uppercase tracking-[0.12em]"
              style={{
                color: "var(--color-accent)",
                borderBottom: "2px solid var(--color-divider)",
              }}
            >
              Timeline
            </h2>
            <dl className="m-0">
              {dates.map((d) => (
                <div
                  key={d.id}
                  className="resume-entry flex gap-6 py-3"
                  style={{ borderBottom: "1px solid var(--color-divider)" }}
                >
                  <dt className="mono-label w-[72px] flex-none">{d.year}</dt>
                  <dd className="m-0 text-sm">{d.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
