"use client";

import Link from "next/link";
import { LinkIcon, iconFor } from "@/lib/icons";
import type { Portfolio } from "@/lib/types";
import { pageAddress } from "@/lib/types";
import {
  LensGate,
  Media,
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
} from "../shared";

/* ── 3a Links — tabs over a stack of tappable rows ────────────────────── */

export function Links({ p }: { p: Portfolio }) {
  const handle = usePublishedHandle();
  const pageHref = usePageHref(p);
  const record = useRecordClick();
  const { tab, setTab, shown, nav, gated } = useTabFilter(p);
  const showContact = usePublishedPrivacy().showContact;
  const cta = p.header.links[0];

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
          className="px-5 pt-10 pb-6"
          style={{ borderBottom: "2px solid var(--color-divider)" }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="h-28 w-28 flex-none">
              <Media asset={p.header.portrait} className="h-full w-full" />
            </div>
            <h2
              className="m-0 mt-5"
              style={{ ...headline("32px"), lineHeight: 1.02, letterSpacing: "-0.035em" }}
            >
              {p.header.name}
            </h2>
            <p
              className="m-0 mt-2.5 max-w-[34ch] text-[15px] leading-[1.5]"
              style={{ color: "var(--color-neutral-800)" }}
            >
              {p.header.description}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2">
            {p.header.tags.map((t, i) => (
              <span
                key={t}
                className="pb-1 text-[13px]"
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

        {nav !== "scroll" && (
          // A segmented control: equal tracks across the column. The variant
          // owns the sizing a grid cell needs, so nothing has to be cancelled
          // from out here.
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${Math.max(tabs(p).length, 1)}, minmax(0, 1fr))`,
              borderBottom: "2px solid var(--color-divider)",
            }}
          >
            <Tabs p={p} tab={tab} setTab={setTab} variant="segment" />
          </div>
        )}

        {shown.map((s, i) => {
          const first = s.links[0];
          const sub = first?.label || s.description || s.tab;
          const rowIcon = first ? iconFor(first) : "link";
          const inner = (
            <>
              {/* 44px, not 34px: this tile is the visual anchor of a row a
                  thumb is aiming at, and it now matches the minimum every
                  other control on the page clears. */}
              <span
                className="font-heading flex h-11 w-11 flex-none items-center justify-center text-[13px] font-extrabold"
                // Both the glyph and its rule are drawn from the row's own
                // colour, so a press — which repaints the row in the accent
                // and its ink in the page's paper — carries the tile with it
                // instead of leaving an accent glyph on an accent field.
                style={{
                  color: "inherit",
                  boxShadow:
                    "inset 0 0 0 2px color-mix(in srgb, currentColor 35%, transparent)",
                }}
              >
                {rowIcon === "link" ? (
                  String(i + 1).padStart(2, "0")
                ) : (
                  <LinkIcon id={rowIcon} size={21} />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-heading text-[17px] leading-tight font-extrabold tracking-[-0.015em]">
                  {s.title}
                </span>
                <span className="truncate text-[13px] opacity-75">{sub}</span>
              </span>
              <UiIcon id={first ? "out" : "chevron"} size={20} />
            </>
          );
          // 44px minimum hit target — these rows are built for a thumb.
          const rowClass =
            "flex min-h-[76px] items-center gap-3.5 px-5 py-3.5 no-underline";
          const rowStyle = {
            borderBottom: "1px solid var(--color-divider)",
            color: "var(--color-ink)",
            transition:
              "background 160ms var(--ease-out), color 160ms var(--ease-out)",
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
              // --color-bg, not white: the accent field is drawn in the
              // page's own paper everywhere else in the product, and a dark
              // ground wants ink on the accent rather than white.
              e.currentTarget.style.color = "var(--color-bg)";
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

        {showContact && (
          <div
            className="flex gap-2.5 px-5 py-5"
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
          <span className="mono-label">{pageAddress(handle, p.slug)}</span>
        </div>
      </div>
    </div>
  );
}
