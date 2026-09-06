"use client";

import Link from "next/link";
import type { Portfolio } from "@/lib/types";
import { pageAddress } from "@/lib/types";
import {
  LensGate,
  Media,
  Tabs,
  groundStyle,
  headline,
  href,
  saveContact,
  useTabFilter,
  usePageHref,
  usePublishedHandle,
  usePublishedPrivacy,
  useRecordClick,
} from "../shared";

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
        <LensGate p={p} setTab={setTab} />
      </div>
    );
  }

  return (
    <div style={groundStyle(p)}>

      <div className="mx-auto w-full max-w-[560px]">
        <div
          className="px-[18px] pb-4 pt-6"
          style={{ borderBottom: "2px solid var(--color-divider)" }}
        >
          <div className="flex items-start gap-3.5">
            <div className="h-[72px] w-[72px] flex-none">
              <Media asset={p.header.portrait} className="h-full w-full" />
            </div>
            <div>
              <h2 className="m-0 mb-1" style={headline("24px")}>{p.header.name}</h2>
              <p className="m-0 text-[13px]" style={{ color: "var(--color-neutral-800)" }}>
                {p.header.description}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.header.tags.map((t, i) => (
              <span key={t} className={`tag ${i === 0 ? "tag-accent" : "tag-neutral"}`}>
                {t}
              </span>
            ))}
          </div>
        </div>

        {nav !== "scroll" && (
          <div
            className="flex gap-[18px] overflow-x-auto px-[18px]"
            style={{ borderBottom: "2px solid var(--color-divider)" }}
          >
            <Tabs p={p} tab={tab} setTab={setTab} variant="underline" />
          </div>
        )}

        {shown.map((s, i) => {
          const first = s.links[0];
          const sub = first?.label || s.description || s.tab;
          const inner = (
            <>
              <span
                className="font-heading flex h-[34px] w-[34px] flex-none items-center justify-center text-xs font-extrabold"
                style={{
                  color: "var(--color-accent)",
                  boxShadow: "inset 0 0 0 2px var(--color-divider)",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-heading text-[15px] font-extrabold leading-tight">
                  {s.title}
                </span>
                <span
                  className="truncate text-xs"
                  style={{ color: "var(--color-neutral-700)" }}
                >
                  {sub}
                </span>
              </span>
              <span
                className="font-heading ml-auto pl-2 text-sm font-extrabold"
                style={{ color: "var(--color-neutral-700)" }}
              >
                {first ? "↗" : "›"}
              </span>
            </>
          );
          // 44px minimum hit target — these rows are built for a thumb.
          const rowClass =
            "flex min-h-[56px] items-center gap-3 px-[18px] py-3.5 no-underline";
          const rowStyle = {
            borderBottom: "1px solid var(--color-divider)",
            color: "var(--color-ink)",
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
            >
              {inner}
            </a>
          ) : (
            <Link
              key={s.id}
              href={`${pageHref}?section=${s.id}`}
              className={rowClass}
              style={rowStyle}
            >
              {inner}
            </Link>
          );
        })}

        {showContact && (
          <div
            className="flex gap-2 px-[18px] py-4"
            style={{ borderBottom: "2px solid var(--color-divider)" }}
          >
            {cta && (
              <a
                href={href(cta.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary flex-1"
              >
                {cta.label}
              </a>
            )}
            <button
              type="button"
              className={`btn btn-secondary ${cta ? "" : "flex-1"}`}
              onClick={() => saveContact(p, handle)}
            >
              Save contact
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 px-[18px] py-3.5">
          <span className="text-[11px]" style={{ color: "var(--color-neutral-700)" }}>
            {pageAddress(handle, p.slug)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Ledger — everything as one long table ────────────────────────────── */

