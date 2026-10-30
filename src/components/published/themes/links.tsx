"use client";

import Link from "next/link";
import { LinkIcon, iconFor } from "@/lib/icons";
import type { Portfolio, Section } from "@/lib/types";
import { pageAddress } from "@/lib/types";
import {
  LensGate,
  Media,
  PlateTurn,
  Tabs,
  UiIcon,
  groundStyle,
  headline,
  href,
  saveContact,
  tabs,
  useTabFilter,
  usePageHref,
  usePublishedHandle,
  usePublishedPrivacy,
  useRecordClick,
  visibleSections,
} from "../shared";

/* ── 3a Links — the pocket index ──────────────────────────────────────────
   The slip of an index a catalogue tucks inside its cover: one narrow
   column, every plate as a numbered line, sized for a thumb. The only
   theme where the caption comes before the plate, because a line in an
   index is all the reader gets until they tap it.
   ────────────────────────────────────────────────────────────────────── */

export function Links({ p }: { p: Portfolio }) {
  const handle = usePublishedHandle();
  const pageHref = usePageHref(p);
  const record = useRecordClick();
  const { tab, setTab, shown, nav, gated } = useTabFilter(p);
  const showContact = usePublishedPrivacy().showContact;
  const cta = p.header.links[0];
  const all = visibleSections(p);
  const plateNo = (s: Section) => all.indexOf(s) + 1;

  if (gated) {
    return (
      <div style={groundStyle(p)}>
        {/* Links sizes itself for a thumb rather than from the density
            control, so the gate takes the column's own padding. */}
        <LensGate p={p} setTab={setTab} padClass="px-5 py-10" />
      </div>
    );
  }

  return (
    <div style={groundStyle(p)}>
      <div className="mx-auto w-full max-w-[30rem]">
        <div
          className="px-5 pt-10 pb-7"
          style={{ borderBottom: "1px solid var(--color-ink)" }}
        >
          <div className="flex flex-col items-center text-center">
            <figure className="m-0 h-28 w-28 flex-none">
              <Media asset={p.header.portrait} className="h-full w-full" caption="frontispiece" />
            </figure>
            <h2
              className="m-0 mt-6"
              style={{ ...headline("33px"), lineHeight: 1.04, letterSpacing: "-0.02em" }}
            >
              {p.header.name}
            </h2>
            {p.header.current && (
              <p className="caption-credit mt-3 mb-0">{p.header.current}</p>
            )}
            <p className="m-0 mt-3 max-w-[34ch] text-[15px] leading-[1.55] text-muted">
              {p.header.description}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
            {p.header.tags.map((t) => (
              <span
                key={t}
                className="caption-credit pb-1.5"
                // Every tag rules the same. A mark-coloured first tag reads
                // as a selected item in a navigation, which is exactly what
                // sits directly beneath it.
                style={{ borderBottom: "1px solid var(--color-divider)" }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {nav !== "scroll" && (
          // A segmented control: equal tracks across the column. The variant
          // owns the sizing a grid cell needs, so nothing has to be cancelled
          // from out here.
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${Math.max(tabs(p).length, 1)}, minmax(0, 1fr))`,
              borderBottom: "1px solid var(--color-divider)",
            }}
          >
            <Tabs p={p} tab={tab} setTab={setTab} variant="segment" />
          </div>
        )}

        <PlateTurn>
          {shown.map((s) => {
            const first = s.links[0];
            const sub = first?.label || s.description || s.tab;
            const inner = (
              <>
                {/* The plate number, ruled into a square that clears 44px —
                    this is the anchor a thumb aims at, and in an index the
                    number is what identifies the line. */}
                <span
                  className="plate-no flex h-11 w-11 flex-none items-center justify-center text-[15px]"
                  // Both the figure and its rule are drawn from the row's own
                  // colour, so a press — which repaints the row in the accent
                  // and its ink to match — carries the square with it instead
                  // of leaving a stale colour inside a repainted row.
                  style={{
                    color: "inherit",
                    boxShadow:
                      "inset 0 0 0 1px color-mix(in srgb, currentColor 42%, transparent)",
                  }}
                >
                  {String(plateNo(s)).padStart(2, "0")}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-heading text-[18px] leading-tight tracking-[-0.01em]">
                    {s.title}
                  </span>
                  <span className="caption-credit flex min-w-0 items-center gap-1.5">
                    {first && <LinkIcon id={iconFor(first)} size={13} />}
                    <span className="truncate" style={{ color: "inherit" }}>
                      {sub}
                    </span>
                  </span>
                </span>
                <UiIcon id={first ? "out" : "chevron"} size={19} />
              </>
            );
            // 44px minimum hit target — these rows are built for a thumb.
            const rowClass =
              "flex min-h-[78px] items-center gap-3.5 px-5 py-3.5 no-underline";
            const rowStyle = {
              borderBottom: "1px solid var(--color-divider)",
              color: "var(--color-ink)",
              transition:
                "background 180ms var(--ease-out), color 180ms var(--ease-out)",
            };
            // Direct style writes, not state — a re-render per touch would be
            // wasteful and isn't needed since nothing else depends on this.
            const clearPress = (e: React.PointerEvent<HTMLAnchorElement>) => {
              e.currentTarget.style.background = "";
              e.currentTarget.style.color = "";
            };
            const pressHandlers = {
              onPointerDown: (e: React.PointerEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.background = "var(--color-accent)";
                // The ink worked out for this accent, not white: a pale accent
                // under white lettering is a row nobody can read at the exact
                // moment they are pressing it.
                e.currentTarget.style.color = "var(--color-accent-ink)";
              },
              onPointerUp: clearPress,
              // A touch that ends in a scroll fires cancel, not up — without
              // this a row can get stuck showing the accent colour.
              onPointerCancel: clearPress,
              onPointerLeave: clearPress,
            };
            return first ? (
              <a
                key={s.id}
                href={href(first.url)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => record(handle, p.slug, s.id)}
                className={rowClass}
                style={rowStyle}
                {...pressHandlers}
              >
                {inner}
              </a>
            ) : (
              <Link
                key={s.id}
                href={`${pageHref}?section=${s.id}`}
                className={rowClass}
                style={rowStyle}
                {...pressHandlers}
              >
                {inner}
              </Link>
            );
          })}
        </PlateTurn>

        {showContact && (
          <div
            className="flex gap-2.5 px-5 py-6"
            style={{ borderTop: "1px solid var(--color-divider)" }}
          >
            {cta && (
              <a
                href={href(cta.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary min-h-[52px] flex-1 justify-center"
              >
                <LinkIcon id={iconFor(cta)} size={18} />
                {cta.label}
              </a>
            )}
            <button
              type="button"
              className={`btn btn-secondary min-h-[52px] justify-center ${cta ? "" : "flex-1"}`}
              onClick={() => saveContact(p, handle)}
            >
              <UiIcon id="download" size={18} />
              Save contact
            </button>
          </div>
        )}

        <div className="flex justify-center px-5 pt-1 pb-10">
          <span className="caption-credit">{pageAddress(handle, p.slug)}</span>
        </div>
      </div>
    </div>
  );
}
