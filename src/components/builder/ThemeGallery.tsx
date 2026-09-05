"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeThumb } from "./controls";
import { usePortfolios } from "@/lib/store";
import {
  THEME_AUDIENCES,
  THEMES,
  type Portfolio,
  type ThemeAudience,
  previewPath,
} from "@/lib/types";
import { PublishedLock } from "../PublishedLock";

export function ThemeGallery({ id }: { id: string }) {
  const { ready, getPortfolio, updatePortfolio } = usePortfolios();
  const [filter, setFilter] = useState<ThemeAudience | null>(null);
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

  // A live page is frozen — the API refuses every write to it — so this
  // screen steps aside for Preview and Unpublish rather than rendering
  // controls that can only fail.
  if (portfolio.status === "live") {
    return <PublishedLock portfolio={portfolio} />;
  }

  const p: Portfolio = portfolio;
  const shown = filter ? THEMES.filter((t) => t.audiences.includes(filter)) : THEMES;
  const selected = THEMES.find((t) => t.id === p.theme);

  return (
    <>
      <div className="nav bg-bg">
        <span className="nav-brand">FACET</span>
        <span className="text-neutral-700 text-xs">Choose a theme</span>
        <Link href={`/builder/${p.id}`} className="btn btn-ghost ml-auto">
          Skip for now
        </Link>
      </div>

      <div className="border-divider border-b-2 px-6 pb-6 pt-8 sm:px-10">
        <h1 className="mb-3 text-[34px] sm:text-[46px]">Pick a starting theme</h1>
        <p className="mb-5 max-w-[60ch] text-[17px]">
          Every theme carries the same content. You can swap themes at any time
          without losing a word, and change colour, type and layout after.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`tag cursor-pointer ${filter === null ? "tag-accent" : "tag-neutral"}`}
          >
            All
          </button>
          {THEME_AUDIENCES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setFilter(a.id)}
              className={`tag cursor-pointer ${filter === a.id ? "tag-accent" : "tag-neutral"}`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* Cell borders, not gap-bleed — a partly-filled last row would
          otherwise leave empty grey blocks where the ground shows through. */}
      <div className="border-divider grid sm:grid-cols-2 lg:grid-cols-3 [&>*]:border-b [&>*]:border-r [&>*]:border-[var(--color-divider)]">
        {shown.map((t) => {
          const on = p.theme === t.id;
          return (
            <div key={t.id} className="bg-bg p-5">
              <ThemeThumb theme={t.id} accent={p.accent} size="lg" />
              <div className="mb-1 mt-3.5 flex items-baseline gap-2">
                <span className="font-heading text-lg font-extrabold">{t.name}</span>
                {(on || t.badge) && (
                  <span
                    className="font-heading text-[10px] font-extrabold uppercase tracking-[0.06em]"
                    style={{
                      color: on ? "var(--color-accent)" : "var(--color-neutral-600)",
                    }}
                  >
                    {on ? "Selected" : t.badge}
                  </span>
                )}
              </div>
              <p className="text-neutral-800 mb-3 text-[13px]">{t.long}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`btn ${on ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => updatePortfolio(p.id, (prev) => ({ ...prev, theme: t.id }))}
                >
                  {on ? "Selected" : "Use theme"}
                </button>
                <Link
                  href={previewPath(p.id)}
                  className="btn btn-secondary"
                  // A new tab, because the point of a preview is seeing the page
                  // with nothing of the app around it — exactly what a visitor gets.
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Preview
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-divider flex flex-wrap items-center gap-4 border-t-2 px-6 py-6 sm:px-10">
        <span className="text-neutral-700 text-[13px]">
          Selected: <strong>{selected?.name ?? "—"}</strong>
        </span>
        <button
          type="button"
          className="btn btn-secondary ml-auto"
          onClick={() => router.back()}
        >
          Back
        </button>
        <Link href={`/builder/${p.id}`} className="btn btn-primary">
          Continue to the builder
        </Link>
      </div>
    </>
  );
}
