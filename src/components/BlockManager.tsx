"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAnalytics } from "@/lib/analytics";
import { usePortfolios } from "@/lib/store";
import { roles } from "./published/themes";
import {
  BLOCK_ICON,
  BLOCK_TYPES,
  type BlockKind,
  type Portfolio,
} from "@/lib/types";

/** The bottom bar of the phone-sized manage view. */
function BottomNav({ p }: { p: Portfolio }) {
  const items = [
    { label: "Page", href: `/p/${p.slug}` },
    { label: "Blocks", href: `/blocks/${p.id}` },
    { label: "Stats", href: `/stats?p=${p.id}` },
    { label: "Settings", href: `/builder/${p.id}` },
  ];
  return (
    <div className="border-divider grid grid-cols-4 border-t-2">
      {items.map((item) => {
        const on = item.label === "Blocks";
        return (
          <Link
            key={item.label}
            href={item.href}
            className="font-heading px-1 py-3 text-center text-[11px] font-extrabold no-underline"
            style={{
              background: on ? "var(--color-accent)" : "var(--color-bg)",
              color: on ? "var(--color-bg)" : "var(--color-neutral-700)",
              borderRight: "1px solid var(--color-divider)",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function BlockManager({ id }: { id: string }) {
  const {
    ready,
    storageError,
    getPortfolio,
    addBlock,
    toggleSectionHidden,
    moveSection,
    deleteSection,
  } = usePortfolios();
  const analytics = useAnalytics();
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const portfolio = getPortfolio(id);

  if (!portfolio) {
    return (
      <div className="p-10">
        <h2>{ready ? "That portfolio doesn't exist." : "Loading…"}</h2>
        {ready && <Link href="/">← Back to portfolios</Link>}
      </div>
    );
  }

  const p: Portfolio = portfolio;
  const clicks = analytics.clicks[p.slug] ?? {};
  const views = analytics.views[p.slug] ?? 0;
  const pageRoles = roles(p);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`https://facet.page/${p.slug}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked — stay silent rather than claim a copy that failed.
    }
  }

  function add(kind: BlockKind) {
    const added = addBlock(p.id, kind);
    setAdding(false);
    // A new block is empty, so send the author straight to where it is filled in.
    router.push(`/editor/${p.id}#section-${added}`);
  }

  return (
    <>
      <div className="nav bg-bg gap-3">
        <Link href="/" className="font-heading text-[13px] font-extrabold">
          ← Portfolios
        </Link>
        <span className="nav-brand mr-auto text-[15px]">Blocks</span>
        <Link href={`/p/${p.slug}`} className="btn btn-secondary">
          Preview
        </Link>
        <Link href={`/builder/${p.id}`} className="btn btn-secondary">
          Builder
        </Link>
      </div>

      {storageError && (
        <div
          role="alert"
          className="px-4 py-2.5 text-[13px] font-extrabold"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          {storageError}
        </div>
      )}

      <div className="mx-auto grid w-full max-w-[900px] lg:grid-cols-2">
        {/* ── the list ──────────────────────────────────────────────── */}
        <div className="border-divider lg:border-r-2">
          <div className="border-divider bg-surface flex items-center gap-2.5 border-b-2 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="font-heading truncate text-sm font-extrabold">
                facet.page/{p.slug}
              </div>
              <div className="text-neutral-700 text-[11px]">
                {p.status === "live" ? "Live" : "Not published"} · {views}{" "}
                {views === 1 ? "view" : "views"} counted here
              </div>
            </div>
            <button type="button" className="btn btn-secondary flex-none" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="flex items-baseline gap-2 px-4 pb-2 pt-3">
            <h6 className="m-0">Blocks</h6>
            <span className="text-neutral-700 ml-auto text-[11px]">
              {p.sections.length} total · {p.sections.filter((s) => s.hidden).length} hidden
            </span>
          </div>

          {p.sections.map((s, i) => (
            <div
              key={s.id}
              // Wraps rather than overflowing: on a phone the action cluster
              // drops to its own line instead of pushing the page sideways.
              className="border-divider flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3"
              style={{ opacity: s.hidden ? 0.5 : 1 }}
            >
              <span
                className="font-heading flex h-8 w-8 flex-none items-center justify-center text-xs font-extrabold"
                style={{
                  color: "var(--color-accent)",
                  boxShadow: "inset 0 0 0 2px var(--color-divider)",
                }}
                aria-hidden
              >
                {BLOCK_ICON[s.kind]}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-extrabold leading-tight">
                  {s.title || "Untitled block"}
                </span>
                <span className="text-neutral-700 text-[11px]">
                  {BLOCK_TYPES.find((b) => b.id === s.kind)?.name ?? "Link"} ·{" "}
                  {clicks[s.id] ?? 0} clicks
                </span>
              </span>

              <span
                className="font-heading flex-none px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.06em]"
                style={
                  s.hidden
                    ? {
                        color: "var(--color-neutral-600)",
                        boxShadow: "inset 0 0 0 1px var(--color-divider)",
                      }
                    : { background: "var(--color-accent)", color: "var(--color-bg)" }
                }
              >
                {s.hidden ? "Hidden" : "On"}
              </span>

              <span className="flex w-full flex-none justify-end gap-1 sm:w-auto">
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  aria-label={`Move ${s.title || "block"} up`}
                  disabled={i === 0}
                  onClick={() => moveSection(p.id, s.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  aria-label={`Move ${s.title || "block"} down`}
                  disabled={i === p.sections.length - 1}
                  onClick={() => moveSection(p.id, s.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-secondary text-xs"
                  onClick={() => toggleSectionHidden(p.id, s.id)}
                >
                  {s.hidden ? "Show" : "Hide"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  onClick={() => deleteSection(p.id, s.id)}
                >
                  Delete
                </button>
              </span>
            </div>
          ))}

          {p.sections.length === 0 && (
            <p className="text-neutral-700 m-0 px-4 py-6 text-[13px]">
              No blocks yet. Add one below.
            </p>
          )}

          <div className="border-divider border-b-2 p-3.5">
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => setAdding((v) => !v)}
            >
              {adding ? "Close" : "+ Add block"}
            </button>
          </div>

          <BottomNav p={p} />
        </div>

        {/* ── the add-block picker ──────────────────────────────────── */}
        <div className={adding ? "" : "hidden lg:block"}>
          <div className="border-divider flex items-center border-b-2 px-4 py-3.5">
            <span className="font-heading text-[15px] font-extrabold">Add a block</span>
            {adding && (
              <button
                type="button"
                className="btn btn-ghost ml-auto"
                onClick={() => setAdding(false)}
              >
                Close
              </button>
            )}
          </div>

          <div className="px-4 pb-3.5 pt-3">
            <h6 className="mb-2.5">Roles</h6>
            <div className="flex flex-wrap gap-1.5">
              {pageRoles.map((r, i) => (
                <span key={r} className={`tag ${i === 0 ? "tag-accent" : "tag-neutral"}`}>
                  {r}
                </span>
              ))}
              <Link href={`/editor/${p.id}`} className="tag tag-outline no-underline">
                + New role
              </Link>
            </div>
            <p className="text-neutral-700 mt-2 text-[11px]">
              Roles are the tags on your blocks. Add a tag in the editor and it becomes
              a filter a visitor can use.
            </p>
          </div>

          <div className="border-divider grid grid-cols-2 border-t-2 [&>*]:border-b [&>*]:border-r [&>*]:border-[var(--color-divider)]">
            {BLOCK_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => add(t.id)}
                className="bg-bg flex cursor-pointer flex-col gap-1 p-3.5 text-left"
              >
                <span
                  className="font-heading text-base font-extrabold"
                  style={{ color: "var(--color-accent)" }}
                  aria-hidden
                >
                  {t.icon}
                </span>
                <span className="font-heading text-[13px] font-extrabold">{t.name}</span>
                <span className="text-neutral-700 text-[11px]">{t.desc}</span>
              </button>
            ))}
          </div>

          <p className="text-neutral-700 m-0 px-4 py-3.5 text-[11px]">
            A block’s type picks its glyph and its starting title. Underneath, every
            block is the same four fields — title, description, tags, links — so there
            is nothing to learn twice.
          </p>
        </div>
      </div>
    </>
  );
}
