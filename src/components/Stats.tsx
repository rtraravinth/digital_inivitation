"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AppHeader } from "./AppHeader";
import { PagePreview } from "./PagePreview";
import { CountUp } from "./published/fx";
import { Bars, LegendMark, Ring, Sparkline, TrendChart, longDay, type Day } from "./stats/charts";
import { ICON, Icon, NoHandleNotice, Segmented, TiltPanel } from "./ui";
import {
  RANGES,
  dailySeries,
  refreshAnalytics,
  setAnalyticsRange,
  useAnalytics,
  useAnalyticsRange,
  useAnalyticsReady,
  type RangeDays,
} from "@/lib/analytics";
import { usePortfolios } from "@/lib/store";
import { previewPath, type Portfolio } from "@/lib/types";
import { useAccount } from "@/lib/account";

/* ── Stats ────────────────────────────────────────────────────────────────
   How many people opened your pages, where they came from, and what they
   clicked — in that order, because that is the order the questions come in.

   Built like Portfolios: the same header, backdrop, segmented controls and
   3D panels. Every figure is a real count from the server for the window
   picked; nothing is estimated, and an empty window says so in words.
   ──────────────────────────────────────────────────────────────────────── */

const EASE = [0.16, 1, 0.3, 1] as const;
const ALL = "all";

/** Enter one after another, swinging up off their bottom edge. */
function rise(i: number, reduced: boolean | null) {
  return {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 24, rotateX: -12 },
    animate: { opacity: 1, y: 0, rotateX: 0 },
    transition: { duration: 0.65, delay: Math.min(i, 10) * 0.06, ease: EASE },
    style: { transformOrigin: "50% 100%" },
  };
}

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function Stats() {
  const { portfolios: everyPortfolio, ready: portfoliosReady } = usePortfolios();
  // Live pages only. A draft cannot be visited — its public address answers
  // 404 until it is published — so listing it here only ever showed a zero.
  const portfolios = everyPortfolio.filter((p) => p.status === "live");
  const analytics = useAnalytics();
  const analyticsReady = useAnalyticsReady();
  const range = useAnalyticsRange();
  const params = useSearchParams();
  const reduced = useReducedMotion();
  const { account, ready: accountReady } = useAccount();
  const handle = account.profile.handle;
  // ?p= deep-links one page's stats — the Portfolios menu's "Views and clicks".
  const [picked, setPicked] = useState<string | null>(() => params.get("p"));
  const [refreshing, setRefreshing] = useState(false);
  const [asTable, setAsTable] = useState(false);

  const selected = picked && picked !== ALL ? portfolios.find((p) => p.id === picked) : undefined;
  const scope: Portfolio[] = selected ? [selected] : portfolios;
  const slugs = scope.map((p) => p.slug);

  const views = slugs.reduce((n, s) => n + (analytics.views[s] ?? 0), 0);
  const clicks = slugs.reduce(
    (n, s) => n + Object.values(analytics.clicks[s] ?? {}).reduce((a, b) => a + b, 0),
    0,
  );
  const series: Day[] = dailySeries(analytics, slugs, range);
  const sourceTotals: Record<string, number> = {};
  for (const s of slugs) {
    for (const [name, n] of Object.entries(analytics.sources[s] ?? {})) {
      sourceTotals[name] = (sourceTotals[name] ?? 0) + n;
    }
  }
  const sources = Object.entries(sourceTotals).sort((a, b) => b[1] - a[1]);
  const topSource = sources[0];
  const rate = pct(clicks, views);
  const hasData = views > 0 || clicks > 0;
  const busiest = series.reduce<Day | null>((best, d) => (d.views > (best?.views ?? 0) ? d : best), null);

  const sectionRows = selected
    ? selected.sections
        .filter((s) => !s.hidden)
        .map((s) => ({
          id: s.id,
          label: s.title || "Untitled section",
          note: "",
          value: analytics.clicks[selected.slug]?.[s.id] ?? 0,
          hasLink: s.links.length > 0,
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  const pageRows = portfolios
    .map((p) => {
      const v = analytics.views[p.slug] ?? 0;
      const c = Object.values(analytics.clicks[p.slug] ?? {}).reduce((a, b) => a + b, 0);
      return { p, views: v, clicks: c };
    })
    .sort((a, b) => b.views - a.views);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshAnalytics();
    } finally {
      setRefreshing(false);
    }
  };

  const loading = !portfoliosReady || !analyticsReady;

  return (
    <>
      <div aria-hidden className="app-backdrop" />
      <div
        className="flex min-h-dvh flex-col"
        onPointerMove={(e) => {
          if (reduced || e.pointerType !== "mouse") return;
          document.documentElement.style.setProperty("--mx", `${e.clientX}px`);
          document.documentElement.style.setProperty("--my", `${e.clientY}px`);
        }}
      >
        <AppHeader current="stats" />

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-8 pb-20 sm:px-6 sm:pt-12" style={{ perspective: 1600 }}>
          {/* ── title row ───────────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div className="min-w-0">
              <motion.h1
                initial={reduced ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.6, ease: EASE }}
                className="m-0 text-[28px] leading-tight tracking-[-0.03em] sm:text-[34px]"
              >
                Stats
              </motion.h1>
              <motion.p
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="m-0 mt-1.5 max-w-[60ch] text-[14px] text-muted"
              >
                Real visits to your published pages over the last {range} days, counted
                across every visitor. Nothing here is estimated.
              </motion.p>
            </div>
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
              className="ml-auto flex items-center gap-2"
            >
              <Segmented
                label="Time range"
                id="range"
                value={String(range)}
                onChange={(v) => setAnalyticsRange(Number(v) as RangeDays)}
                options={RANGES.map((d) => ({ id: String(d), label: `${d} days` }))}
              />
              <button
                type="button"
                aria-label="Refresh figures"
                title="Refresh figures"
                onClick={refresh}
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-[var(--color-neutral-200)]"
                style={{ border: "1px solid var(--color-divider)", background: "var(--color-bg)" }}
              >
                <motion.span
                  animate={{ rotate: refreshing ? 360 : 0 }}
                  transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { duration: 0 }}
                  className="grid place-items-center"
                >
                  <Icon d={<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />} size={15} />
                </motion.span>
              </button>
            </motion.div>
          </div>

          {accountReady && !handle && portfolios.length > 0 && (
            <div className="mt-6">
              <NoHandleNotice live={portfolios.length} />
            </div>
          )}

          {loading ? (
            <Loading />
          ) : portfolios.length === 0 ? (
            <NoPages />
          ) : (
            <>
              {/* ── which page ──────────────────────────────────── */}
              <section aria-label="Choose a page" className="mt-8">
                <div className="fx-rail -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-3 sm:-mx-6 sm:scroll-px-6 sm:px-6">
                  <PickCard
                    on={!selected}
                    onPick={() => setPicked(ALL)}
                    title="All pages"
                    subtitle={`${portfolios.length} ${portfolios.length === 1 ? "page" : "pages"}`}
                    figure={pageRows.reduce((n, r) => n + r.views, 0)}
                  >
                    <div className="grid h-full w-full grid-cols-3 gap-1 p-2.5">
                      {portfolios.slice(0, 6).map((p) => (
                        <span
                          key={p.id}
                          className="rounded-sm"
                          style={{ background: "color-mix(in srgb, var(--color-ink) 12%, transparent)" }}
                        />
                      ))}
                    </div>
                  </PickCard>
                  {portfolios.map((p) => (
                    <PickCard
                      key={p.id}
                      on={selected?.id === p.id}
                      onPick={() => setPicked(p.id)}
                      title={p.name}
                      live={p.status === "live"}
                      figure={analytics.views[p.slug] ?? 0}
                    >
                      <PagePreview p={p} handle={handle} />
                    </PickCard>
                  ))}
                </div>
              </section>

              {/* ── the four figures ────────────────────────────── */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${picked ?? ALL}-${range}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                >
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <motion.div {...rise(0, reduced)}>
                      <Tile
                        label="Visits"
                        help="Times your page was opened"
                        value={views.toLocaleString()}
                      >
                        <Sparkline values={series.map((d) => d.views)} />
                      </Tile>
                    </motion.div>
                    <motion.div {...rise(1, reduced)}>
                      <Tile
                        label="Link clicks"
                        help="Clicks on the links in your sections"
                        value={clicks.toLocaleString()}
                      >
                        <Sparkline values={series.map((d) => d.clicks)} dashed />
                      </Tile>
                    </motion.div>
                    <motion.div {...rise(2, reduced)}>
                      <Tile
                        label="Click rate"
                        help={views > 0 ? `About ${rate} in every 100 visits clicked a link` : "Shows once your page has visits"}
                        value={views > 0 ? `${rate}%` : "—"}
                        aside={<Ring share={views > 0 ? clicks / views : 0} />}
                      />
                    </motion.div>
                    <motion.div {...rise(3, reduced)}>
                      <Tile
                        label="Top source"
                        help={topSource ? `${pct(topSource[1], views)}% of visits came from here` : "Where most visitors come from"}
                        text={topSource ? topSource[0] : "—"}
                      />
                    </motion.div>
                  </div>

                  {!hasData ? (
                    <motion.div {...rise(4, reduced)} className="mt-5">
                      <Quiet selected={selected} range={range} />
                    </motion.div>
                  ) : (
                    <>
                      {/* ── the trend ────────────────────────────── */}
                      <motion.div {...rise(4, reduced)} className="mt-5">
                        <TiltPanel max={1.5} lift={2} className="rounded-2xl p-5 sm:p-6">
                          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                            <h2 className="m-0 text-[16px] tracking-[-0.01em]">Visits over time</h2>
                            <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
                              <LegendMark kind="views" /> Visits
                            </span>
                            <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
                              <LegendMark kind="clicks" /> Link clicks
                            </span>
                            <button
                              type="button"
                              aria-pressed={asTable}
                              onClick={() => setAsTable((v) => !v)}
                              className="btn btn-ghost ml-auto"
                              style={{ minHeight: 30, padding: "0.3rem 0.6rem", fontSize: 12.5 }}
                            >
                              {asTable ? "Show chart" : "Show as table"}
                            </button>
                          </div>
                          {asTable ? (
                            <DayTable data={series} />
                          ) : (
                            <>
                              <TrendChart data={series} />
                              <p className="m-0 mt-2 text-[12px]" style={{ color: "var(--color-neutral-600)" }}>
                                Point at the chart, or focus it and use the arrow keys, to read a day.
                              </p>
                            </>
                          )}
                        </TiltPanel>
                      </motion.div>

                      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                        {/* ── sources ──────────────────────────── */}
                        <motion.div {...rise(5, reduced)}>
                          <TiltPanel max={3} lift={3} className="h-full rounded-2xl p-5 sm:p-6">
                            <PanelHead title="Where visitors come from" help="The site or app that sent each visit. “Direct” means a typed or saved link." />
                            {sources.length === 0 ? (
                              <p className="m-0 text-[13.5px] text-muted">No visits in this window.</p>
                            ) : (
                              <Bars unit="visits" rows={sources.map(([name, n]) => ({ id: name, label: name, value: n }))} />
                            )}
                          </TiltPanel>
                        </motion.div>

                        {/* ── what people click, or which page ─── */}
                        <motion.div {...rise(6, reduced)}>
                          <TiltPanel max={3} lift={3} className="h-full rounded-2xl p-5 sm:p-6">
                            {selected ? (
                              <>
                                <PanelHead title="What people click" help="Clicks on each section’s links. A section with no link can’t be clicked." />
                                {sectionRows.length === 0 ? (
                                  <p className="m-0 text-[13.5px] text-muted">This page has no sections yet.</p>
                                ) : (
                                  <Bars
                                    unit="clicks"
                                    rows={sectionRows.map((r) => ({
                                      id: r.id,
                                      label: r.label,
                                      note: r.hasLink ? r.note : "No link",
                                      value: r.value,
                                    }))}
                                  />
                                )}
                              </>
                            ) : (
                              <>
                                <PanelHead title="Your pages" help="Visits and link clicks for each page. Pick one above to see its detail." />
                                <PagesTable rows={pageRows} onPick={(id) => setPicked(id)} />
                              </>
                            )}
                          </TiltPanel>
                        </motion.div>
                      </div>

                      {/* ── in plain words ───────────────────────── */}
                      <motion.div {...rise(7, reduced)} className="mt-5">
                        <Summary
                          range={range}
                          views={views}
                          clicks={clicks}
                          rate={rate}
                          busiest={busiest}
                          topSource={topSource}
                          sourceShare={topSource ? pct(topSource[1], views) : 0}
                          topSection={sectionRows.find((r) => r.value > 0)}
                          unlinked={sectionRows.filter((r) => !r.hasLink).length}
                          selected={selected}
                        />
                      </motion.div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </main>
      </div>
    </>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────── */

function PickCard({
  on,
  onPick,
  title,
  subtitle,
  live,
  figure,
  children,
}: {
  on: boolean;
  onPick: () => void;
  title: string;
  subtitle?: string;
  live?: boolean;
  figure: number;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  // A container with a button stretched over it, not a <button> around it:
  // the preview inside is a real page with buttons of its own, and a button
  // inside a button is invalid HTML that breaks hydration.
  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -3, rotateX: 4 }}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="group relative flex w-[200px] flex-none snap-start flex-col overflow-hidden rounded-xl text-left"
      style={{
        transformPerspective: 800,
        background: "var(--color-bg)",
        border: `1px solid ${on ? "var(--color-ink)" : "var(--color-divider)"}`,
        boxShadow: on ? "0 0 0 1px var(--color-ink), var(--shadow-md)" : "none",
      }}
    >
      <span
        className="relative block aspect-[16/9] overflow-hidden grayscale transition-[filter] duration-500 group-hover:grayscale-0"
        style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-divider)" }}
      >
        {children}
      </span>
      <span className="flex flex-col gap-0.5 px-3 py-2.5">
        <span className="truncate text-[13.5px] font-medium">{title}</span>
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          {live !== undefined && (
            <span
              aria-hidden
              className="h-1.5 w-1.5 flex-none rounded-full"
              style={
                live
                  ? { background: "var(--color-ink)" }
                  : { boxShadow: "inset 0 0 0 1px var(--color-neutral-500)" }
              }
            />
          )}
          {subtitle ?? (live ? "Live" : "Draft")}
          <span className="ml-auto font-mono">{figure.toLocaleString()}</span>
        </span>
      </span>
      <button
        type="button"
        aria-pressed={on}
        aria-label={`${title}: ${figure.toLocaleString()} ${figure === 1 ? "visit" : "visits"}`}
        onClick={onPick}
        className="absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
      />
    </motion.div>
  );
}

function Tile({
  label,
  help,
  value,
  text,
  aside,
  children,
}: {
  label: string;
  help: string;
  value?: string;
  text?: string;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <TiltPanel className="flex h-full min-h-[168px] flex-col rounded-2xl p-5">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <div className="mt-2 flex items-center gap-3">
        {value !== undefined ? (
          <CountUp
            value={value}
            className="text-[34px] leading-none font-semibold tracking-[-0.03em]"
          />
        ) : (
          <span className="truncate text-[26px] leading-tight font-semibold tracking-[-0.02em]">{text}</span>
        )}
        {aside && <span className="ml-auto">{aside}</span>}
      </div>
      <span className="mt-1.5 text-[12.5px] leading-snug" style={{ color: "var(--color-neutral-600)" }}>
        {help}
      </span>
      {children && <div className="mt-auto pt-3">{children}</div>}
    </TiltPanel>
  );
}

function PanelHead({ title, help }: { title: string; help: string }) {
  return (
    <div className="mb-5">
      <h2 className="m-0 text-[16px] tracking-[-0.01em]">{title}</h2>
      <p className="m-0 mt-1 text-[12.5px] text-muted">{help}</p>
    </div>
  );
}

function PagesTable({
  rows,
  onPick,
}: {
  rows: Array<{ p: Portfolio; views: number; clicks: number }>;
  onPick: (id: string) => void;
}) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {rows.map(({ p, views, clicks }, i) => (
        <li key={p.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--color-divider)" }}>
          <button
            type="button"
            onClick={() => onPick(p.id)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-[var(--color-surface)]"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium">{p.name}</span>
              <span className="text-[12px] text-muted">{p.status === "live" ? "Live" : "Draft"}</span>
            </span>
            <span className="text-right font-mono text-[12.5px]">
              {views.toLocaleString()}
              <span className="block text-[11px]" style={{ color: "var(--color-neutral-600)" }}>
                visits
              </span>
            </span>
            <span className="w-14 text-right font-mono text-[12.5px]">
              {clicks.toLocaleString()}
              <span className="block text-[11px]" style={{ color: "var(--color-neutral-600)" }}>
                clicks
              </span>
            </span>
            <span style={{ color: "var(--color-neutral-600)" }}>
              <Icon d={<path d="m9 6 6 6-6 6" />} size={14} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DayTable({ data }: { data: Day[] }) {
  return (
    <div className="max-h-[300px] overflow-auto rounded-lg" style={{ border: "1px solid var(--color-divider)" }}>
      <table className="table">
        <thead>
          <tr>
            <th>Day</th>
            <th style={{ textAlign: "right" }}>Visits</th>
            <th style={{ textAlign: "right" }}>Link clicks</th>
          </tr>
        </thead>
        <tbody>
          {[...data].reverse().map((d) => (
            <tr key={d.day}>
              <td>{longDay(d.day)}</td>
              <td style={{ textAlign: "right" }} className="font-mono">{d.views}</td>
              <td style={{ textAlign: "right" }} className="font-mono">{d.clicks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The figures, said in sentences — what a person would tell you looking at them. */
function Summary({
  range,
  views,
  clicks,
  rate,
  busiest,
  topSource,
  sourceShare,
  topSection,
  unlinked,
  selected,
}: {
  range: number;
  views: number;
  clicks: number;
  rate: number;
  busiest: Day | null;
  topSource: [string, number] | undefined;
  sourceShare: number;
  topSection: { label: string; value: number } | undefined;
  unlinked: number;
  selected: Portfolio | undefined;
}) {
  const lines: string[] = [
    `${selected ? "This page was" : "Your pages were"} opened ${views.toLocaleString()} ${views === 1 ? "time" : "times"} in the last ${range} days, and visitors clicked a link ${clicks.toLocaleString()} ${clicks === 1 ? "time" : "times"}${views > 0 ? ` — about ${rate} in every 100 visits` : ""}.`,
  ];
  if (busiest && busiest.views > 0) {
    lines.push(`The busiest day was ${longDay(busiest.day)}, with ${busiest.views} ${busiest.views === 1 ? "visit" : "visits"}.`);
  }
  if (topSource) {
    lines.push(`Most visitors came from ${topSource[0]} (${sourceShare}%).`);
  }
  if (topSection) {
    lines.push(`“${topSection.label}” got the most clicks — ${topSection.value}. Keeping it near the top helps.`);
  }
  if (unlinked > 0) {
    lines.push(`${unlinked} ${unlinked === 1 ? "section has" : "sections have"} no link, so ${unlinked === 1 ? "it" : "they"} can’t be clicked. Add one in the editor if you want people to act on ${unlinked === 1 ? "it" : "them"}.`);
  }

  return (
    <div
      className="rounded-2xl p-5 sm:p-6"
      style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
    >
      <h2 className="m-0 text-[16px] tracking-[-0.01em]" style={{ color: "inherit" }}>
        In plain words
      </h2>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0 text-[14px] leading-relaxed">
        {lines.map((l) => (
          <li key={l} className="flex gap-2.5">
            <span aria-hidden className="mt-[0.6em] h-1 w-1 flex-none rounded-full" style={{ background: "currentColor" }} />
            <span>{l}</span>
          </li>
        ))}
      </ul>
      {selected && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/editor/${selected.id}`}
            className="btn"
            style={{ background: "var(--color-bg)", color: "var(--color-ink)", minHeight: 32, padding: "0.35rem 0.85rem", fontSize: 13 }}
          >
            Open the editor
          </Link>
          <a
            href={previewPath(selected.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{ color: "var(--color-bg)", border: "1px solid color-mix(in srgb, var(--color-bg) 40%, transparent)", minHeight: 32, padding: "0.35rem 0.85rem", fontSize: 13 }}
          >
            <Icon d={ICON.eye} size={14} />
            Preview
          </a>
        </div>
      )}
    </div>
  );
}

/* ── states ───────────────────────────────────────────────────────────── */

function Loading() {
  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[168px] animate-pulse rounded-2xl"
          style={{ background: "var(--color-neutral-200)" }}
        />
      ))}
    </div>
  );
}

function NoPages() {
  return (
    <div
      className="mt-8 flex flex-col items-center rounded-2xl px-6 py-16 text-center"
      style={{ border: "1.5px dashed var(--color-neutral-400)", background: "var(--color-bg)" }}
    >
      <h2 className="m-0 text-[18px] tracking-[-0.01em]">No published pages yet</h2>
      <p className="m-0 mt-2 max-w-[46ch] text-[14px] text-muted">
        Stats are for live pages: a draft can’t be visited, so it has nothing to
        count. Publish a page from Portfolios, share the link, and its figures
        show up here.
      </p>
      <Link href="/" className="btn btn-primary mt-6">
        Go to Portfolios
      </Link>
    </div>
  );
}

/** A window with nothing in it — said plainly, with what to do about it. */
function Quiet({ selected, range }: { selected: Portfolio | undefined; range: number }) {
  return (
    <div
      className="flex flex-col items-center rounded-2xl px-6 py-14 text-center"
      style={{ border: "1.5px dashed var(--color-neutral-400)", background: "var(--color-bg)" }}
    >
      <span
        aria-hidden
        className="mb-4 grid h-11 w-11 place-items-center rounded-full"
        style={{ boxShadow: "inset 0 0 0 1px var(--color-divider)" }}
      >
        <Icon d={ICON.eye} size={18} />
      </span>
      <h2 className="m-0 text-[17px] tracking-[-0.01em]">No visits in the last {range} days</h2>
      <p className="m-0 mt-2 max-w-[52ch] text-[14px] text-muted">
        A visit counts when someone opens a published page; a click counts when they
        follow a link in one of its sections. Your own previews never count. Share your
        link and the figures appear here as people arrive.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {selected ? (
          <a href={previewPath(selected.id)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Preview the page
          </a>
        ) : (
          <Link href="/" className="btn btn-primary">
            Go to Portfolios
          </Link>
        )}
        {range < 90 && (
          <button type="button" className="btn btn-secondary" onClick={() => setAnalyticsRange(90)}>
            Look at 90 days
          </button>
        )}
      </div>
    </div>
  );
}
