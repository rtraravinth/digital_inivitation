"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";

/* ── the charts on /stats ─────────────────────────────────────────────────
   Hand-built SVG, no library: the app's CSP-free bundle stays small, and
   every chart follows the light and dark tokens like the rest of the page.

   The rules they keep (from the dataviz method):
   - One y-axis. Views and clicks are both counts, so they share it.
   - Identity is never shade alone: clicks are dashed as well as lighter,
     there is a legend, and the tooltip names both.
   - Thin marks — 2px lines, a light area under the primary series only.
   - Grid and axes recede; values wear text colours, never the series'.
   - Every chart has a hover layer and a keyboard path, and the trend has a
     table view.
   ──────────────────────────────────────────────────────────────────────── */

export type Day = { day: string; views: number; clicks: number };

const EASE = [0.16, 1, 0.3, 1] as const;

/** "28 Oct" — a UTC day, since that is how the server buckets them. */
function shortDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function longDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** A round axis top a little above the data, so the peak is not on the frame. */
function niceMax(n: number): number {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const top = step * pow;
    if (top >= n * 1.1) return top;
  }
  return 10 * pow;
}

/** Measures its box with a ref callback — setState from an effect is refused by the compiler lint. */
function useWidth(): [(node: HTMLDivElement | null) => (() => void) | undefined, number] {
  const [width, setWidth] = useState(0);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/* ── the trend ────────────────────────────────────────────────────────── */

export function TrendChart({ data, height = 260 }: { data: Day[]; height?: number }) {
  const [ref, width] = useWidth();
  const [at, setAt] = useState<number | null>(null);
  const reduced = useReducedMotion();

  const pad = { top: 16, right: 12, bottom: 28, left: 34 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const top = niceMax(Math.max(...data.map((d) => Math.max(d.views, d.clicks)), 0));
  const x = (i: number) => pad.left + (data.length <= 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v: number) => pad.top + h - (v / top) * h;

  const line = (key: "views" | "clicks") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join("");
  const area = `${line("views")}L${x(data.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f));
  // About five date labels, whatever the window: every day of 90 is a smear.
  const every = Math.max(1, Math.ceil(data.length / 5));

  const point = at !== null ? data[at] : null;
  const pickFrom = (clientX: number, box: DOMRect) => {
    const rel = clientX - box.left - pad.left;
    const i = Math.round((rel / Math.max(1, w)) * (data.length - 1));
    setAt(Math.min(data.length - 1, Math.max(0, i)));
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Views and clicks per day, ${shortDay(data[0].day)} to ${shortDay(data[data.length - 1].day)}`}
          tabIndex={0}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] rounded-md"
          onPointerMove={(e) => pickFrom(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setAt(null)}
          onFocus={() => setAt((v) => v ?? data.length - 1)}
          onBlur={() => setAt(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setAt((v) => Math.max(0, (v ?? data.length) - 1));
            else if (e.key === "ArrowRight") setAt((v) => Math.min(data.length - 1, (v ?? -1) + 1));
            else if (e.key === "Home") setAt(0);
            else if (e.key === "End") setAt(data.length - 1);
            else return;
            e.preventDefault();
          }}
        >
          {/* Recessive grid and its numbers. */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.left}
                x2={pad.left + w}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-divider)"
                strokeDasharray={t === 0 ? undefined : "2 4"}
              />
              <text
                x={pad.left - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                fontSize="11"
                fill="var(--color-neutral-600)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {t}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % every === 0 || i === data.length - 1 ? (
              <text
                key={d.day}
                x={x(i)}
                y={height - 8}
                textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                fontSize="11"
                fill="var(--color-neutral-600)"
              >
                {shortDay(d.day)}
              </text>
            ) : null,
          )}

          <motion.path
            d={area}
            fill="color-mix(in srgb, var(--chart-1) 9%, transparent)"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />
          <motion.path
            d={line("views")}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: EASE }}
          />
          <motion.path
            d={line("clicks")}
            fill="none"
            stroke="var(--chart-2)"
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          />

          {point && at !== null && (
            <g pointerEvents="none">
              <line
                x1={x(at)}
                x2={x(at)}
                y1={pad.top}
                y2={pad.top + h}
                stroke="color-mix(in srgb, var(--color-ink) 30%, transparent)"
              />
              {(["views", "clicks"] as const).map((k) => (
                <circle
                  key={k}
                  cx={x(at)}
                  cy={y(point[k])}
                  r={4.5}
                  fill={k === "views" ? "var(--chart-1)" : "var(--color-bg)"}
                  stroke={k === "views" ? "var(--color-bg)" : "var(--chart-2)"}
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
          {/* A hit target as tall as the plot, so the pointer need not find the line. */}
          <rect x={pad.left} y={pad.top} width={w} height={h} fill="transparent" />
        </svg>
      )}

      <AnimatePresence>
        {point && at !== null && (
          <motion.div
            key="tip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute top-1 z-10 min-w-[140px] rounded-lg px-3 py-2 text-[12.5px]"
            style={{
              left: Math.min(Math.max(x(at) - 70, 0), Math.max(0, width - 150)),
              background: "var(--color-bg)",
              border: "1px solid var(--color-divider)",
              boxShadow: "var(--shadow-md)",
            }}
            role="status"
          >
            <div className="mb-1 font-medium">{longDay(point.day)}</div>
            <div className="flex items-center gap-2">
              <LegendMark kind="views" />
              <span className="text-muted">Visits</span>
              <span className="ml-auto font-mono">{point.views}</span>
            </div>
            <div className="flex items-center gap-2">
              <LegendMark kind="clicks" />
              <span className="text-muted">Link clicks</span>
              <span className="ml-auto font-mono">{point.clicks}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The legend's own swatch: a solid stroke for views, a dashed one for clicks. */
export function LegendMark({ kind }: { kind: "views" | "clicks" }) {
  return (
    <svg width="18" height="8" aria-hidden className="flex-none">
      <line
        x1="1"
        x2="17"
        y1="4"
        y2="4"
        stroke={kind === "views" ? "var(--chart-1)" : "var(--chart-2)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={kind === "clicks" ? "4 3" : undefined}
      />
    </svg>
  );
}

/* ── small pieces ─────────────────────────────────────────────────────── */

/** A tile's sparkline: the shape only, no axes — the tile's number is the value. */
export function Sparkline({
  values,
  dashed,
  height = 36,
}: {
  values: number[];
  dashed?: boolean;
  height?: number;
}) {
  const [ref, width] = useWidth();
  const reduced = useReducedMotion();
  const top = Math.max(1, ...values);
  const x = (i: number) => (values.length <= 1 ? width / 2 : (i / (values.length - 1)) * width);
  const y = (v: number) => 3 + (height - 6) * (1 - v / top);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const stroke = dashed ? "var(--chart-2)" : "var(--chart-1)";

  return (
    <div ref={ref} aria-hidden style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible">
          {!dashed && (
            <path
              d={`${d}L${width},${height}L0,${height}Z`}
              fill="color-mix(in srgb, var(--chart-1) 8%, transparent)"
            />
          )}
          <motion.path
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={1.75}
            strokeDasharray={dashed ? "4 3" : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduced || dashed ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: EASE }}
          />
        </svg>
      )}
    </div>
  );
}

/** A share as a ring that fills to it. `share` is 0–1. */
export function Ring({ share, size = 56 }: { share: number; size?: number }) {
  const reduced = useReducedMotion();
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} aria-hidden className="flex-none -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-neutral-200)" strokeWidth={6} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={reduced ? false : { strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, share))) }}
        transition={{ duration: 1.1, ease: EASE }}
      />
    </svg>
  );
}

/**
 * Horizontal bars, one per row, each with its value written beside it — the
 * value is read, the bar only shows proportion, so there is no tooltip to
 * hunt for.
 */
export function Bars({
  rows,
  unit,
}: {
  rows: Array<{ id: string; label: string; value: number; note?: string }>;
  unit: string;
}) {
  const reduced = useReducedMotion();
  const top = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((n, r) => n + r.value, 0);
  return (
    <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
      {rows.map((r, i) => (
        <li key={r.id}>
          <div className="mb-1.5 flex items-baseline gap-2 text-[13.5px]">
            <span className="min-w-0 truncate font-medium">{r.label}</span>
            {r.note && <span className="min-w-0 truncate text-[12px] text-muted">{r.note}</span>}
            <span className="ml-auto flex-none font-mono text-[12.5px]">
              {r.value.toLocaleString()}{" "}
              <span style={{ color: "var(--color-neutral-600)" }}>
                {total > 0 ? `· ${Math.round((r.value / total) * 100)}%` : ""}
              </span>
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full"
            style={{ background: "var(--color-neutral-200)" }}
            role="img"
            aria-label={`${r.label}: ${r.value} ${unit}`}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--chart-1)" }}
              initial={reduced ? false : { width: 0 }}
              animate={{ width: `${(r.value / top) * 100}%` }}
              transition={{ duration: 0.9, delay: Math.min(i, 8) * 0.06, ease: EASE }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
