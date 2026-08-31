"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { recordClick } from "@/lib/analytics";
import { FONTS, type Asset, type Ground, type Portfolio, type Section } from "@/lib/types";

const HATCH =
  "repeating-linear-gradient(45deg,#d7d3d3 0 6px,#eae9e9 6px 12px)";

/** Ground swaps the page's ink and paper; the accent is chosen separately. */
const GROUNDS: Record<Ground, Record<string, string>> = {
  light: {
    "--color-bg": "#f3f2f2",
    "--color-surface": "#eae9e9",
    "--color-ink": "#201e1d",
    "--color-divider": "#201e1d66",
    "--color-neutral-700": "#605d5d",
    "--color-neutral-800": "#444141",
  },
  dark: {
    "--color-bg": "#201e1d",
    "--color-surface": "#2d2b2b",
    "--color-ink": "#f3f2f2",
    "--color-divider": "#f3f2f266",
    "--color-neutral-700": "#bab6b6",
    "--color-neutral-800": "#d7d3d3",
  },
  paper: {
    "--color-bg": "#efe9dd",
    "--color-surface": "#e5dece",
    "--color-ink": "#201e1d",
    "--color-divider": "#201e1d66",
    "--color-neutral-700": "#6b6154",
    "--color-neutral-800": "#4a4238",
  },
};

/** Overriding the system's own variables lets every .btn/.tag follow along. */
export function groundStyle(p: Portfolio): CSSProperties {
  const face = FONTS.find((x) => x.id === p.font) ?? FONTS[0];
  return {
    ...GROUNDS[p.ground],
    "--color-accent": p.accent,
    "--font-heading": `var(${face.cssVar}), system-ui, sans-serif`,
    background: "var(--color-bg)",
    color: "var(--color-ink)",
  } as CSSProperties;
}

/**
 * Roles are the tags used across the sections. Capped at six, most-used
 * first — the tab row is a row, not a tag cloud.
 */
export function roles(p: Portfolio): string[] {
  const counts = new Map<string, number>();
  for (const s of p.sections) {
    for (const t of s.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([t]) => t);
}

/** The optional extras aggregate up from the sections to the page. */
function allNumbers(p: Portfolio) {
  return p.sections.flatMap((s) => s.numbers).filter((n) => n.value.trim());
}

function allDates(p: Portfolio) {
  return p.sections
    .flatMap((s) => s.dates)
    .filter((d) => d.year.trim())
    .sort((a, b) => a.year.localeCompare(b.year));
}

function StatRow({ p, big }: { p: Portfolio; big?: boolean }) {
  const nums = allNumbers(p);
  if (nums.length === 0) return null;
  return (
    // Cell borders rather than gap-bleed: a partly-filled last row would
    // otherwise show the divider ground as empty grey blocks.
    <div
      className="grid grid-cols-2 md:grid-cols-4"
      style={{
        background: "var(--color-bg)",
        borderTop: "2px solid var(--color-divider)",
      }}
    >
      {nums.slice(0, 8).map((n) => (
        <div
          key={n.id}
          className="px-5 py-6"
          style={{
            background: "var(--color-bg)",
            borderRight: "1px solid var(--color-divider)",
            borderBottom: "1px solid var(--color-divider)",
          }}
        >
          <div
            className="font-heading font-extrabold leading-none"
            style={{
              fontSize: big ? 40 : 32,
              color: big ? "var(--color-accent)" : "inherit",
            }}
          >
            {n.value}
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--color-neutral-700)" }}>
            {n.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function useRoleFilter(p: Portfolio) {
  const [role, setRole] = useState<string | null>(null);
  const shown = role ? p.sections.filter((s) => s.tags.includes(role)) : p.sections;
  return { role, setRole, shown };
}

function Tabs({
  p,
  role,
  setRole,
  variant,
}: {
  p: Portfolio;
  role: string | null;
  setRole: (r: string | null) => void;
  variant: "underline" | "block";
}) {
  const all = [null, ...roles(p)];
  return (
    <>
      {all.map((r) => {
        const on = r === role;
        const label = r ?? "All work";
        if (variant === "block") {
          return (
            <button
              key={label}
              type="button"
              onClick={() => setRole(r)}
              className="font-heading cursor-pointer px-4 py-2.5 text-[13px] font-extrabold"
              style={{
                background: on ? "var(--color-bg)" : "transparent",
                color: on ? "var(--color-ink)" : "inherit",
                opacity: on ? 1 : 0.75,
              }}
            >
              {label}
            </button>
          );
        }
        return (
          <button
            key={label}
            type="button"
            onClick={() => setRole(r)}
            className="font-heading cursor-pointer py-3.5 text-sm font-extrabold"
            style={{
              color: on ? "var(--color-accent)" : "var(--color-neutral-700)",
              boxShadow: on ? "inset 0 -3px 0 var(--color-accent)" : "none",
            }}
          >
            {label}
          </button>
        );
      })}
    </>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-3.5 text-[11px] uppercase tracking-[0.1em]"
      style={{ color: "var(--color-accent)" }}
    >
      {children}
    </div>
  );
}

/** Seed URLs are written bare ("northwell.in"), so fill in a scheme. */
function href(url: string) {
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return trimmed;
  if (trimmed.includes("@") && !trimmed.includes("/")) return `mailto:${trimmed}`;
  let path = trimmed;
  while (path.startsWith("/")) path = path.slice(1);
  return `https://${path}`;
}

function SectionLinks({ p, section }: { p: Portfolio; section: Section }) {
  if (section.links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
      {section.links.map((l) => (
        <a
          key={l.id}
          href={href(l.url)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => recordClick(p.slug, section.id)}
          style={{ color: "var(--color-accent)" }}
        >
          {l.label || l.url} ↗
        </a>
      ))}
    </div>
  );
}

/** A stored image, or the hatched placeholder when there is none. */
function Media({
  asset,
  className,
  caption,
}: {
  asset: Asset | null;
  className: string;
  caption?: string;
}) {
  if (asset) {
    // A data URI out of localStorage — nothing for next/image to optimise.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.dataUrl}
        alt={asset.name}
        className={`grayscale-photo object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`grayscale-photo flex items-end p-2.5 ${className}`}
      style={{ background: HATCH }}
    >
      {caption && <span className="text-[10px] text-neutral-700">{caption}</span>}
    </div>
  );
}

/** The pull quote and the downloadable attachment, when a section has them. */
function SectionAside({ p, section }: { p: Portfolio; section: Section }) {
  return (
    <>
      {section.quote?.text && (
        <blockquote
          className="m-0 py-1 pl-3.5 text-[15px] italic"
          style={{ borderLeft: "3px solid var(--color-accent)" }}
        >
          “{section.quote.text}”
          {section.quote.attribution && (
            <footer
              className="mt-1 text-[12px] not-italic"
              style={{ color: "var(--color-neutral-700)" }}
            >
              — {section.quote.attribution}
            </footer>
          )}
        </blockquote>
      )}
      {section.file && (
        <a
          href={section.file.dataUrl}
          download={section.file.name}
          onClick={() => recordClick(p.slug, section.id)}
          className="btn btn-secondary self-start"
          style={{ fontSize: 12, padding: "4px 10px" }}
        >
          ↓ {section.file.name}
        </a>
      )}
    </>
  );
}

function ClaimBar() {
  return (
    <div className="nav" style={{ background: "var(--color-bg)" }}>
      <span className="nav-brand">FACET</span>
      <span className="text-[13px] opacity-70">Explore</span>
      <span className="text-[13px] opacity-70">Log in</span>
      <button type="button" className="btn btn-primary">
        Claim your page
      </button>
    </div>
  );
}

/* ── 1a Editorial — tabs across a modular grid ────────────────────────── */

export function Editorial({ p }: { p: Portfolio }) {
  const { role, setRole, shown } = useRoleFilter(p);
  const cta = p.header.links[0];
  const numbers = allNumbers(p);
  const dates = allDates(p);

  return (
    <div style={groundStyle(p)}>
      <ClaimBar />

      <div className="grid gap-12 px-6 pb-8 pt-10 md:grid-cols-[1fr_380px] md:px-10">
        <div>
          {p.header.current && <Kicker>{p.header.current}</Kicker>}
          <h1 className="m-0 mb-4 text-[40px] leading-[1.02] md:text-[64px]">
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

      <div
        className="flex gap-7 overflow-x-auto px-6 md:px-10"
        style={{ borderBottom: "2px solid var(--color-divider)" }}
      >
        <Tabs p={p} role={role} setRole={setRole} variant="underline" />
      </div>

      {/* 1a: cards span two columns, "By the numbers" holds the third. */}
      <div
        className="grid lg:grid-cols-[1fr_1fr_340px]"
        style={{ borderBottom: "2px solid var(--color-divider)" }}
      >
        <div
          className="grid sm:grid-cols-2 lg:col-span-2"
          style={{ borderRight: "2px solid var(--color-divider)" }}
        >
          {shown.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-2.5 p-6"
              style={{
                background: "var(--color-bg)",
                borderRight: "1px solid var(--color-divider)",
                borderBottom: "1px solid var(--color-divider)",
              }}
            >
              {s.image && <Media asset={s.image} className="mb-1 h-[150px] w-full" />}
              {s.tags[0] && <span className="card-kicker">{s.tags[0]}</span>}
              <span className="font-heading text-[21px] font-extrabold leading-tight">
                {s.title}
              </span>
              <p className="m-0 flex-1 text-sm opacity-80">{s.description}</p>
              <SectionAside p={p} section={s} />
              <SectionLinks p={p} section={s} />
            </div>
          ))}
        </div>

        {numbers.length > 0 && (
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
        {cta && (
          <button
            type="button"
            className="btn md:ml-auto"
            style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}
          >
            {cta.label}
          </button>
        )}
        <button
          type="button"
          className="btn"
          style={{ borderColor: "var(--color-bg)", color: "var(--color-bg)" }}
        >
          facet.page/{p.slug}
        </button>
      </div>
    </div>
  );
}

/* ── 1b Index rail — roles as a numbered sidebar, records as a table ──── */

export function IndexRail({ p }: { p: Portfolio }) {
  const { role, setRole, shown } = useRoleFilter(p);
  const all = [null, ...roles(p)];

  return (
    <div style={groundStyle(p)}>
      <ClaimBar />

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
          <h2 className="mb-1.5 text-[30px]">{p.header.name}</h2>
          <p className="mb-5 text-[13px]" style={{ color: "var(--color-neutral-700)" }}>
            {p.header.current}
          </p>

          <div style={{ borderTop: "2px solid var(--color-divider)" }}>
            {all.map((r, i) => {
              const on = r === role;
              const count = r
                ? p.sections.filter((s) => s.tags.includes(r)).length
                : p.sections.length;
              return (
                <button
                  key={r ?? "all"}
                  type="button"
                  onClick={() => setRole(r)}
                  className="flex w-full cursor-pointer items-center gap-3 py-2.5 text-left text-sm"
                  style={{
                    borderBottom: "1px solid var(--color-divider)",
                    color: on ? "var(--color-accent)" : "inherit",
                    fontWeight: on ? 800 : 400,
                  }}
                >
                  <span className="font-heading text-[11px] font-extrabold opacity-55">
                    {String(i).padStart(2, "0")}
                  </span>
                  <span>{r ?? "All work"}</span>
                  <span className="ml-auto text-[11px] opacity-55">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-2">
            {p.header.links.map((l) => (
              <button key={l.id} type="button" className="btn btn-secondary btn-block">
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div
            className="px-6 pb-6 pt-8 md:px-9"
            style={{ borderBottom: "2px solid var(--color-divider)" }}
          >
            <Kicker>{role ?? "All work"}</Kicker>
            <p className="m-0 max-w-[60ch] text-[19px]">{p.header.description}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>#</th>
                  <th>Work</th>
                  <th style={{ width: 150 }}>Role</th>
                  <th style={{ width: 210 }}>Links</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s, i) => (
                  <tr key={s.id}>
                    <td className="font-extrabold">{String(i + 1).padStart(2, "0")}</td>
                    <td>
                      <div className="font-extrabold">{s.title}</div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--color-neutral-700)" }}
                      >
                        {s.description}
                      </div>
                    </td>
                    <td>
                      {s.tags[0] && <span className="tag tag-neutral">{s.tags[0]}</span>}
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

/* ── 1c Poster — accent field hero, roles as a statement ──────────────── */

export function Poster({ p }: { p: Portfolio }) {
  const { role, setRole, shown } = useRoleFilter(p);
  const dates = allDates(p);

  return (
    <div style={groundStyle(p)}>
      <div
        className="px-6 pt-8 md:px-11 md:pt-11"
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      >
        <div className="mb-9 flex items-baseline gap-4">
          <span className="font-heading text-lg font-extrabold">FACET</span>
          <span className="text-xs opacity-75">facet.page/{p.slug}</span>
          <button
            type="button"
            className="btn ml-auto"
            style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}
          >
            Claim your page
          </button>
        </div>

        <h1 className="m-0 mb-5 text-[56px] leading-[0.92] tracking-[-0.03em] md:text-[104px]">
          {p.header.name.split(" ").map((w, i) => (
            <span key={`${w}-${i}`} className="block">
              {w}
            </span>
          ))}
        </h1>
        <p className="m-0 mb-9 max-w-[34ch] text-[22px]">{p.header.description}</p>

        <div className="flex flex-wrap">
          <Tabs p={p} role={role} setRole={setRole} variant="block" />
        </div>
      </div>

      <StatRow p={p} big />

      <div
        className="grid md:grid-cols-2"
        style={{ borderTop: "2px solid var(--color-divider)" }}
      >
        {shown.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-3 p-7"
            style={{
              background: "var(--color-bg)",
              borderRight: "1px solid var(--color-divider)",
              borderBottom: "1px solid var(--color-divider)",
            }}
          >
            <div
              className="h-[150px]"
            >
              <Media asset={s.image} className="h-full w-full" caption="image — 16:9" />
            </div>
            {s.tags[0] && <span className="card-kicker">{s.tags[0]}</span>}
            <h3 className="m-0">{s.title}</h3>
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

export function PublishedBody({ p }: { p: Portfolio }) {
  if (p.theme === "index") return <IndexRail p={p} />;
  if (p.theme === "poster") return <Poster p={p} />;
  return <Editorial p={p} />;
}
