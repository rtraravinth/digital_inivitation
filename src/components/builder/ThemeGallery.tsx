"use client";

import Link from "next/link";
import { useState } from "react";
import { Canvas, type Device } from "./Canvas";
import { ThemeThumb } from "./controls";
import { useAccount } from "@/lib/account";
import { Glyph } from "@/lib/glyphs";
import { usePortfolios } from "@/lib/store";
import {
  PROFESSIONS,
  THEMES,
  applyProfession,
  previewPath,
  type Portfolio,
  type ProfessionId,
} from "@/lib/types";
import { PublishedLock } from "../PublishedLock";

/* ── the theme gallery — artboard 2b ──────────────────────────────────────
   Try before you apply. Picking a profession or a theme changes a draft
   that only the preview on the right sees; the portfolio is written once,
   when the author says "Use this look". Every candidate is shown with the
   author's own content in it, because a theme demonstrated on somebody
   else's sample page tells you very little about your own.
   ──────────────────────────────────────────────────────────────────────── */

type Draft = Pick<Portfolio, "theme" | "accent" | "groundHex" | "font" | "bodyFont">;

export function ThemeGallery({ id }: { id: string }) {
  const handle = useAccount().account.profile.handle;
  const { ready, getPortfolio, updatePortfolio } = usePortfolios();
  const [draft, setDraft] = useState<Partial<Draft> | null>(null);
  const [profession, setProfession] = useState<ProfessionId | null>(null);
  const [device, setDevice] = useState<Device>("desktop");

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
  // screen steps aside for Preview and Unpublish rather than offering looks
  // it could never save.
  if (portfolio.status === "live") {
    return <PublishedLock portfolio={portfolio} />;
  }

  const saved: Portfolio = portfolio;
  const shown: Portfolio = draft ? { ...saved, ...draft } : saved;
  const theme = THEMES.find((t) => t.id === shown.theme);
  const look = PROFESSIONS.find((x) => x.id === profession);
  const dirty =
    draft !== null &&
    (Object.keys(draft) as Array<keyof Draft>).some((k) => draft[k] !== saved[k]);

  const pickProfession = (pid: ProfessionId) => {
    const next = applyProfession(saved, pid);
    setProfession(pid);
    setDraft({
      theme: next.theme,
      accent: next.accent,
      groundHex: next.groundHex,
      font: next.font,
      bodyFont: next.bodyFont,
    });
  };

  const apply = () => {
    if (!draft) return;
    const changes = draft;
    updatePortfolio(saved.id, (prev) => ({ ...prev, ...changes }));
    setDraft(null);
    setProfession(null);
  };

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <div className="nav bg-bg flex-none">
        <Link href={`/builder/${saved.id}`} className="btn btn-ghost" aria-label="Back to the builder">
          <Glyph id="back" size={16} />
        </Link>
        <span className="nav-brand">Choose a look</span>
        <span className="text-neutral-700 hidden text-xs sm:inline">{saved.name}</span>
        <Link href={`/builder/${saved.id}`} className="btn btn-ghost ml-auto">
          Skip for now
        </Link>
      </div>

      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* ── the choices ─────────────────────────────────────────── */}
        <div className="border-divider min-h-0 overflow-y-auto lg:border-r">
          <div className="px-5 pt-8 pb-6 sm:px-8">
            <h1 className="mb-3 text-[32px] sm:text-[42px]">What do you do?</h1>
            <p className="text-neutral-800 mb-6 max-w-[56ch] text-[15px]">
              Pick the closest and the preview shows your page dressed for it — theme,
              colour and type. Nothing is saved until you choose to use it.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {PROFESSIONS.map((x) => {
                const on = profession === x.id;
                return (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pickProfession(x.id)}
                    className="flex cursor-pointer flex-col gap-2 p-3 text-left"
                    style={{
                      background: on ? "var(--color-surface)" : "var(--color-bg)",
                      boxShadow: on ? "inset 0 0 0 2px var(--color-foil)" : "inset 0 0 0 1px var(--color-divider)",
                    }}
                  >
                    <span
                      aria-hidden
                      className="relative block h-12 w-full overflow-hidden"
                      style={{ background: x.groundHex }}
                    >
                      <span
                        className="absolute -right-3 -bottom-4 h-14 w-14 rounded-full blur-md"
                        style={{ background: x.accent, opacity: 0.85 }}
                      />
                    </span>
                    <span className="font-heading text-[14px]">{x.name}</span>
                    <span className="text-neutral-700 text-[11px] leading-snug">{x.goal}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-divider border-t px-5 pt-7 pb-10 sm:px-8">
            <h2 className="mb-1.5 text-[22px]">Or start from a theme</h2>
            <p className="text-neutral-700 mb-5 text-[13px]">
              Keeps your colours and type; changes the structure and how it moves.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {THEMES.map((t) => {
                const on = shown.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setProfession(null);
                      setDraft((prev) => ({ ...(prev ?? {}), theme: t.id }));
                    }}
                    className="flex cursor-pointer flex-col text-left"
                    style={{
                      background: on ? "var(--color-surface)" : "var(--color-bg)",
                      boxShadow: on ? "inset 0 0 0 2px var(--color-foil)" : "inset 0 0 0 1px var(--color-divider)",
                    }}
                  >
                    <ThemeThumb theme={t.id} accent={shown.accent} size="lg" />
                    <span className="flex flex-col gap-1.5 p-4">
                      <span className="flex items-baseline gap-2">
                        <span className="font-heading text-[18px]">{t.name}</span>
                        {saved.theme === t.id && (
                          <span className="text-neutral-700 text-[10px] tracking-[0.08em] uppercase">
                            Current
                          </span>
                        )}
                      </span>
                      <span className="text-neutral-800 text-[13px] leading-snug">{t.long}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {t.professions.map((pid) => (
                          <span key={pid} className="tag tag-neutral">
                            {PROFESSIONS.find((x) => x.id === pid)?.name}
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── the preview ─────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-col" style={{ background: "var(--color-surface)" }}>
          <div className="border-divider flex flex-none flex-wrap items-center gap-3 border-b px-5 py-2.5">
            <div className="seg hidden sm:inline-flex" role="radiogroup" aria-label="Device">
              {(["desktop", "mobile"] as Device[]).map((d) => (
                <label key={d} className="seg-opt capitalize">
                  <input
                    type="radio"
                    name="gallery-device"
                    checked={device === d}
                    onChange={() => setDevice(d)}
                  />
                  {d}
                </label>
              ))}
            </div>
            <span className="text-neutral-700 text-[12px]">
              {dirty ? "Previewing" : "Current look"}: <strong>{theme?.name}</strong>
              {look && <> · {look.name}</>}
            </span>
          </div>

          <div className="h-[520px] flex-none p-4 sm:p-6 lg:h-auto lg:min-h-0 lg:flex-1">
            <Canvas p={shown} handle={handle} device={device} />
          </div>

          <div className="border-divider bg-bg flex flex-none flex-wrap items-center gap-2.5 border-t px-5 py-3.5">
            {theme && <span className="text-neutral-700 min-w-0 flex-1 text-[12px]">{theme.depth}</span>}
            {dirty && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setDraft(null);
                  setProfession(null);
                }}
              >
                Reset
              </button>
            )}
            {/* The preview route serves what is saved, so it is only offered
                while the screen shows what is saved. */}
            {!dirty && (
              <Link
                href={previewPath(saved.id)}
                className="btn btn-secondary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open preview
              </Link>
            )}
            {dirty ? (
              <button type="button" className="btn btn-primary" onClick={apply}>
                Use this look
              </button>
            ) : (
              <Link href={`/builder/${saved.id}`} className="btn btn-primary">
                Continue to the builder
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
