"use client";

import { LinkIcon, iconFor } from "@/lib/icons";
import type { Portfolio, Section } from "@/lib/types";
import { pageAddress } from "@/lib/types";
import {
  Kicker,
  LensGate,
  Media,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
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

/* ── 1a Editorial — tabs across a modular grid ────────────────────────── */

/**
 * One card in the Editorial grid.
 *
 * A rule across the top and nothing else. The card used to close itself on
 * the right and the bottom as well, which drew a complete 1px lattice over
 * the page: three columns of boxes that read as a table of contents rather
 * than as a magazine, and left a half-filled last row ruled into empty cells.
 * The column gap does that work now, so only the head of each column is
 * stated.
 */
function SectionCard({ p, section }: { p: Portfolio; section: Section }) {
  return (
    <div
      className={`flex flex-col items-start gap-3.5 ${pad(p).card}`}
      style={{
        background: "var(--color-bg)",
        borderTop: "2px solid var(--color-divider)",
      }}
    >
      {section.image && <Media asset={section.image} className="mb-2 h-[232px] w-full" />}
      <span className="card-kicker">{section.tab}</span>
      <SectionTitleLink
        p={p}
        section={section}
        className="font-heading text-[28px] leading-[1.08] font-extrabold hover:underline"
      />
      <p
        className="m-0 flex-1 text-base leading-[1.6]"
        style={{ color: "var(--color-neutral-800)" }}
      >
        {section.description}
      </p>
      <SectionAside p={p} section={section} />
      <SectionLinks p={p} section={section} />
    </div>
  );
}

export function Editorial({ p }: { p: Portfolio }) {
  const handle = usePublishedHandle();
  const { tab, setTab, shown, nav, chapters, gated } = useTabFilter(p);
  const cta = p.header.links[0];
  const numbers = allNumbers(p);
  const dates = allDates(p);
  const railTabs = tabs(p);
  const showContact = usePublishedPrivacy().showContact;

  if (gated) {
    return (
      <div style={groundStyle(p)}>
        <LensGate p={p} setTab={setTab} />
      </div>
    );
  }

  const cards = (
    <div className={`grid gap-x-12 gap-y-16 px-6 py-16 md:px-10 ${gridCols(p)}`}>
      {shown.map((s) => (
        <SectionCard key={s.id} p={p} section={s} />
      ))}
    </div>
  );

  return (
    <div style={groundStyle(p)}>
      <div className="grid gap-14 px-6 pt-20 pb-16 md:grid-cols-[1fr_440px] md:px-10 md:pt-24">
        <div className="flex flex-col items-start">
          {p.header.current && <Kicker>{p.header.current}</Kicker>}
          <h1
            className="m-0 leading-[0.9]"
            style={{
              ...headline("clamp(52px, 8vw, 104px)"),
              letterSpacing: "-0.045em",
            }}
          >
            {p.header.name}
          </h1>
          <p
            className="m-0 mt-9 max-w-[44ch] text-xl leading-[1.5]"
            style={{ color: "var(--color-neutral-800)" }}
          >
            {p.header.description}
          </p>
          {/* Underlined words rather than filled chips: the tags are a
              standfirst under the headline, not four buttons. */}
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3">
            {p.header.tags.map((t, i) => (
              <span
                key={t}
                className="pb-1 text-[15px]"
                style={
                  i === 0
                    ? { fontWeight: 700, borderBottom: "3px solid var(--color-accent)" }
                    : {
                        fontWeight: 500,
                        color: "var(--color-neutral-800)",
                        borderBottom: "1px solid var(--color-divider)",
                      }
                }
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        {/* 1d puts the portrait at 96px square on a phone. */}
        <div className="h-24 w-24 md:h-[540px] md:w-auto">
          <Media asset={p.header.portrait} className="h-full w-full" caption="portrait — 4:5" />
        </div>
      </div>

      {nav === "tabs" && (
        <div
          className="flex gap-9 overflow-x-auto px-6 md:px-10"
          style={{
            borderTop: "2px solid var(--color-divider)",
            borderBottom: "2px solid var(--color-divider)",
          }}
        >
          <Tabs p={p} tab={tab} setTab={setTab} variant="underline" />
        </div>
      )}

      {nav === "lens" && (
        <div
          className="flex flex-wrap items-center gap-3 px-6 py-4 md:px-10"
          style={{ borderBottom: "2px solid var(--color-divider)" }}
        >
          <span className="mono-label">Showing</span>
          <span className="tag tag-accent">{tab}</span>
        </div>
      )}

      {/* Cards beside "By the numbers" — unless a rail is taking the left. */}
      <div
        className={`grid ${
          nav === "rail"
            ? "lg:grid-cols-[240px_1fr]"
            : numbers.length > 0
              ? "lg:grid-cols-[1fr_320px]"
              : ""
        }`}
      >
        {nav === "rail" && (
          <div
            className="px-6 py-10 md:pl-10"
            style={{ borderRight: "2px solid var(--color-divider)" }}
          >
            {railTabs.map((t, i) => {
              const on = t === tab;
              const count = visibleSections(p).filter((s) => s.tab === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="flex min-h-[52px] w-full cursor-pointer items-center gap-3.5 py-3 text-left text-base"
                  style={{
                    borderBottom: "1px solid var(--color-divider)",
                    color: on ? "var(--color-accent)" : "inherit",
                    fontWeight: on ? 800 : 400,
                    transition: "color 160ms var(--ease-out)",
                  }}
                >
                  <span className="mono-label">{String(i + 1).padStart(2, "0")}</span>
                  <span>{t}</span>
                  <span className="mono-label ml-auto">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {nav === "scroll" ? (
          <div>
            {chapters.map((c) => (
              <div key={c.tab}>
                <div
                  className="px-6 py-4 md:px-10"
                  style={{
                    borderTop: "2px solid var(--color-divider)",
                    borderBottom: "1px solid var(--color-divider)",
                  }}
                >
                  <h6 className="m-0">{c.tab}</h6>
                </div>
                <div className={`grid gap-x-12 gap-y-16 px-6 py-16 md:px-10 ${gridCols(p)}`}>
                  {c.sections.map((s) => (
                    <SectionCard key={s.id} p={p} section={s} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          cards
        )}

        {numbers.length > 0 && nav !== "rail" && (
          <div
            className="px-6 py-16 md:px-10 lg:pl-10"
            style={{ borderLeft: "1px solid var(--color-divider)" }}
          >
            <h6 className="mb-6">By the numbers</h6>
            {numbers.map((n) => (
              <div
                key={n.id}
                className="flex flex-col gap-1 py-5"
                style={{ borderBottom: "1px solid var(--color-divider)" }}
              >
                <div
                  className="font-heading font-extrabold"
                  style={{
                    ...headline("42px"),
                    lineHeight: 0.86,
                    letterSpacing: "-0.035em",
                    color: "var(--color-accent)",
                  }}
                >
                  {n.value}
                </div>
                <div className="mono-label">{n.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The rail takes the column the numbers panel would have used. */}
      {numbers.length > 0 && nav === "rail" && <StatRow p={p} />}

      {dates.length > 0 && (
        <div
          className="px-6 py-16 md:px-10 md:py-20"
          style={{ borderTop: "2px solid var(--color-divider)" }}
        >
          <h6 className="mb-8">Timeline</h6>
          <div className="grid grid-cols-2 gap-x-10 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {dates.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-2.5 pt-5"
                style={{ borderTop: "2px solid var(--color-divider)" }}
              >
                <div
                  className="font-heading text-3xl font-extrabold"
                  style={{ letterSpacing: "-0.03em", color: "var(--color-accent)" }}
                >
                  {e.year}
                </div>
                <div className="text-base leading-[1.45]">{e.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="flex flex-col items-start gap-10 px-6 py-16 md:flex-row md:items-end md:px-10 md:py-20"
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      >
        <div className="flex flex-col gap-5">
          <span className="mono-label" style={{ color: "inherit", opacity: 0.75 }}>
            Get in touch
          </span>
          <div
            className="font-heading max-w-[20ch] font-extrabold"
            style={{ ...headline("46px"), lineHeight: 1.04, letterSpacing: "-0.035em" }}
          >
            Working on something that needs a steady hand on the numbers?
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3.5 md:ml-auto">
          {cta && showContact && (
            <a
              href={href(cta.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn min-h-[52px] px-6"
              style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}
            >
              <LinkIcon id={iconFor(cta)} size={18} />
              {cta.label}
            </a>
          )}
          <span
            className="btn min-h-[52px] px-6"
            style={{ borderColor: "var(--color-bg)", color: "var(--color-bg)" }}
          >
            {pageAddress(handle, p.slug)}
          </span>
        </div>
      </div>
    </div>
  );
}
