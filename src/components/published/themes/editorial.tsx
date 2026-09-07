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

/** One card in the Editorial grid. */
function SectionCard({ p, section }: { p: Portfolio; section: Section }) {
  return (
    <div
      className={`flex flex-col gap-2.5 ${pad(p).card}`}
      style={{
        background: "var(--color-bg)",
        borderRight: "1px solid var(--color-divider)",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      {section.image && <Media asset={section.image} className="mb-1 h-[150px] w-full" />}
      <span className="card-kicker">{section.tab}</span>
      <SectionTitleLink
        p={p}
        section={section}
        className="font-heading text-[21px] font-extrabold leading-tight hover:underline"
      />
      <p className="m-0 flex-1 text-sm opacity-80">{section.description}</p>
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
    <div
      className={`grid ${gridCols(p)}`}
      style={{ borderRight: "1px solid var(--color-divider)" }}
    >
      {shown.map((s) => (
        <SectionCard key={s.id} p={p} section={s} />
      ))}
    </div>
  );

  return (
    <div style={groundStyle(p)}>

      <div className="grid gap-12 px-6 pb-8 pt-10 md:grid-cols-[1fr_380px] md:px-10">
        <div>
          {p.header.current && <Kicker>{p.header.current}</Kicker>}
          <h1 className="m-0 mb-4 leading-[1.02]" style={headline("clamp(40px, 6vw, 64px)")}>
            {p.header.name}
          </h1>
          <p className="m-0 mb-5 max-w-[44ch] text-lg">{p.header.description}</p>
          <div className="flex flex-wrap gap-2">
            {p.header.tags.map((t, i) => (
              <span key={t} className={`tag ${i === 0 ? "tag-accent" : "tag-neutral"}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
        {/* 1d puts the portrait at 96px square on a phone. */}
        <div
          className="h-24 w-24 md:h-[260px] md:w-auto"
        >
          <Media
            asset={p.header.portrait}
            className="h-full w-full"
            caption="portrait — 3:4, b&amp;w"
          />
        </div>
      </div>

      {nav === "tabs" && (
        <div
          className="flex gap-7 overflow-x-auto px-6 md:px-10"
          style={{ borderBottom: "2px solid var(--color-divider)" }}
        >
          <Tabs p={p} tab={tab} setTab={setTab} variant="underline" />
        </div>
      )}

      {nav === "lens" && (
        <div
          className="flex flex-wrap items-center gap-3 px-6 py-3 md:px-10"
          style={{ borderBottom: "2px solid var(--color-divider)" }}
        >
          <span className="text-[12px]" style={{ color: "var(--color-neutral-700)" }}>
            Showing
          </span>
          <span className="tag tag-accent">{tab}</span>
        </div>
      )}

      {/* Cards beside "By the numbers" — unless a rail is taking the left. */}
      <div
        className={`grid ${
          nav === "rail"
            ? "lg:grid-cols-[220px_1fr]"
            : numbers.length > 0
              ? "lg:grid-cols-[1fr_340px]"
              : ""
        }`}
        style={{ borderBottom: "2px solid var(--color-divider)" }}
      >
        {nav === "rail" && (
          <div
            className="p-4"
            style={{
              background: "var(--color-surface)",
              borderRight: "2px solid var(--color-divider)",
            }}
          >
            {railTabs.map((t, i) => {
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
        )}

        {nav === "scroll" ? (
          <div>
            {chapters.map((c) => (
              <div key={c.tab}>
                <div
                  className="px-6 py-3 md:px-10"
                  style={{
                    background: "var(--color-surface)",
                    borderBottom: "1px solid var(--color-divider)",
                  }}
                >
                  <h6 className="m-0">{c.tab}</h6>
                </div>
                <div className={`grid ${gridCols(p)}`}>
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
          <div className="p-6">
            <h6 className="mb-3.5">By the numbers</h6>
            {numbers.map((n) => (
              <div
                key={n.id}
                className="py-3"
                style={{ borderBottom: "1px solid var(--color-divider)" }}
              >
                <div className="font-heading text-[30px] font-extrabold leading-none">
                  {n.value}
                </div>
                <div className="text-xs" style={{ color: "var(--color-neutral-700)" }}>
                  {n.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The rail takes the column the numbers panel would have used. */}
      {numbers.length > 0 && nav === "rail" && <StatRow p={p} />}

      {dates.length > 0 && (
        <div className="px-6 py-8 md:px-10">
          <h6 className="mb-4">Timeline</h6>
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
            style={{ borderTop: "2px solid var(--color-divider)" }}
          >
            {dates.map((e) => (
              <div
                key={e.id}
                className="px-3.5 pb-5 pt-4"
                style={{
                  background: "var(--color-bg)",
                  borderRight: "1px solid var(--color-divider)",
                }}
              >
                <div
                  className="font-heading mb-1.5 text-base font-extrabold"
                  style={{ color: "var(--color-accent)" }}
                >
                  {e.year}
                </div>
                <div className="text-[13px] leading-snug">{e.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="flex flex-col items-start gap-6 px-6 py-7 md:flex-row md:items-center md:px-10"
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      >
        <div className="font-heading max-w-[22ch] text-[26px] font-extrabold leading-[1.15]">
          Working on something that needs a steady hand on the numbers?
        </div>
        {cta && showContact && (
          <a
            href={href(cta.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn md:ml-auto"
            style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}
          >
            <LinkIcon id={iconFor(cta)} />
            {cta.label}
          </a>
        )}
        <span
          className={`btn ${cta && showContact ? "" : "md:ml-auto"}`}
          style={{ borderColor: "var(--color-bg)", color: "var(--color-bg)" }}
        >
          {pageAddress(handle, p.slug)}
        </span>
      </div>
    </div>
  );
}

