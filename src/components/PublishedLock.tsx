"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { PagePreview } from "./PagePreview";
import { ICON, Icon, StatusPill, TiltPanel } from "./ui";
import { Glyph } from "@/lib/glyphs";
import { useAccount } from "@/lib/account";
import { displayUrl, liveUrl } from "@/lib/slug";
import { usePortfolios } from "@/lib/store";
import { previewPath, type Portfolio } from "@/lib/types";

/**
 * What every editing screen shows in place of itself while the portfolio is
 * live. The page a visitor is reading is frozen: the API answers 409 to any
 * write, so offering the controls would only produce error banners. Preview,
 * the live address and Unpublish are what still make sense here.
 */
export function PublishedLock({ portfolio }: { portfolio: Portfolio }) {
  const { updatePortfolio, storageError } = usePortfolios();
  const handle = useAccount().account.profile.handle;
  const reduced = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const url = handle ? liveUrl(handle, portfolio.slug) : "";

  const unpublish = () => updatePortfolio(portfolio.id, (prev) => ({ ...prev, status: "draft" }));

  return (
    <>
      <div aria-hidden className="app-backdrop" />
      <div className="flex min-h-dvh flex-col">
        <header
          className="sticky top-0 z-30 flex h-14 flex-none items-center gap-2 px-3 sm:gap-3 sm:px-6"
          style={{
            background: "color-mix(in srgb, var(--color-bg) 86%, transparent)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--color-divider)",
          }}
        >
          <Link href="/" className="btn btn-ghost" aria-label="Back to portfolios" style={{ marginTop: 0 }}>
            <Glyph id="back" size={16} />
            <span className="hidden sm:inline">Portfolios</span>
          </Link>
          <span className="hidden h-5 w-px sm:block" style={{ background: "var(--color-divider)" }} />
          <span className="min-w-0 truncate text-[14.5px] font-semibold tracking-[-0.01em]">{portfolio.name}</span>
          <StatusPill live />
        </header>

        <main className="mx-auto w-full max-w-[880px] flex-1 px-4 pt-10 pb-20 sm:px-6 sm:pt-14">
          <AnimatePresence>
            {storageError && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 rounded-xl px-4 py-3 text-[13.5px]"
                style={{ border: "1px solid var(--color-ink)", background: "var(--color-bg)" }}
              >
                {storageError}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, rotateX: -10 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "50% 100%", perspective: 1400 }}
          >
            <TiltPanel max={3} className="overflow-hidden rounded-2xl">
              <div className="relative aspect-[16/7] overflow-hidden" style={{ borderBottom: "1px solid var(--color-divider)", background: "var(--color-surface)" }}>
                <PagePreview p={portfolio} handle={handle} />
              </div>
              <div className="p-6 sm:p-8">
                <h1 className="m-0 text-[26px] leading-tight tracking-[-0.03em] sm:text-[30px]">
                  This page is live
                </h1>
                <p className="m-0 mt-2 max-w-[60ch] text-[14.5px] leading-relaxed text-muted">
                  Anyone with the link can read it, so it can’t be edited while it’s live.
                  Unpublish it to make changes, then publish again — the address stays the same.
                </p>

                {url ? (
                  <div
                    className="mt-5 flex min-w-0 items-center gap-2 rounded-xl px-3.5 py-2.5"
                    style={{ background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 flex-1 items-center gap-1.5 font-mono text-[13px] underline-offset-2 hover:underline"
                      style={{ color: "var(--color-ink)" }}
                    >
                      <span className="truncate">{displayUrl(url)}</span>
                      <span className="flex-none">
                        <Icon d={ICON.out} size={12} />
                      </span>
                    </a>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ marginTop: 0, minHeight: 30, padding: "0.3rem 0.6rem", fontSize: 13 }}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(url);
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 1400);
                        } catch {
                          // Clipboard refused — the link is right there to select.
                        }
                      }}
                    >
                      <Icon d={copied ? ICON.check : ICON.copy} size={13} />
                      {copied ? "Copied" : "Copy link"}
                    </button>
                  </div>
                ) : (
                  <p className="m-0 mt-5 rounded-xl px-3.5 py-2.5 text-[13.5px]" style={{ border: "1px solid var(--color-ink)" }}>
                    Your account has no handle, so this page has no address anyone can open.{" "}
                    <Link href="/account" className="font-medium underline underline-offset-2" style={{ color: "var(--color-ink)" }}>
                      Choose a handle
                    </Link>
                  </p>
                )}

                <div className="mt-6 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary" onClick={unpublish}>
                    Unpublish to edit
                  </button>
                  <a href={previewPath(portfolio.id)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                    <Icon d={ICON.eye} size={14} />
                    Preview
                  </a>
                  <Link href={`/stats?p=${portfolio.id}`} className="btn btn-ghost">
                    Views and clicks
                  </Link>
                </div>

                {/* The resume's look never reaches the page, so the freeze leaves it open. */}
                <div
                  className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3.5 py-3 text-[13px]"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}
                >
                  <span className="min-w-0 flex-1">Resume templates and style stay open while the page is live.</span>
                  <a href={`/resume/${portfolio.id}?print=1`} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2" style={{ color: "var(--color-ink)" }}>
                    Resume PDF
                  </a>
                  <Link href={`/builder/${portfolio.id}?mode=resume`} className="font-medium underline underline-offset-2" style={{ color: "var(--color-ink)" }}>
                    Resume templates
                  </Link>
                </div>
              </div>
            </TiltPanel>
          </motion.div>
        </main>
      </div>
    </>
  );
}
