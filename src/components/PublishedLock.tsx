"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { PagePreview } from "./PagePreview";
import { PublishDialog } from "./PublishDialog";
import { ICON, Icon, StatusPill, TiltPanel } from "./ui";
import { Glyph } from "@/lib/glyphs";
import { useAccount } from "@/lib/account";
import { previewHref, resumePrintPath } from "@/lib/resume";
import { displayUrl, liveUrl, resumeUrl } from "@/lib/slug";
import { usePortfolios } from "@/lib/store";
import type { Portfolio } from "@/lib/types";

/**
 * What every editing screen shows in place of itself while the page or the
 * resume is live. What a visitor is reading is frozen: the API answers 409 to
 * any section write, so offering the controls would only produce error
 * banners. Each thing has its own row — address, Copy link, Unpublish — and
 * a row that is not live offers to publish it.
 */
export function PublishedLock({ portfolio }: { portfolio: Portfolio }) {
  const { updatePortfolio, storageError } = usePortfolios();
  const subdomain = useAccount().account.profile.subdomain;
  const reduced = useReducedMotion();
  const [dialog, setDialog] = useState<null | "contact" | "publish-resume">(null);
  const pageLive = portfolio.status === "live";
  const resumeLive = portfolio.resumeStatus === "live";
  const r = portfolio.resume;
  const pc = r.publicContact;
  // What a visitor to the resume sees: a detail only counts if it is there.
  const shown = [
    pc.email && r.email.trim() && "Email",
    pc.phone && r.phone.trim() && "Phone",
    pc.location && r.location.trim() && "Location",
    pc.website && "Website and links",
  ].filter((x): x is string => !!x);

  const unpublish = () =>
    updatePortfolio(portfolio.id, (prev) => ({ ...prev, status: "draft", resumeStatus: "draft" }));

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
          {pageLive && <StatusPill live label="Page live" />}
          {resumeLive && <StatusPill live label="Resume live" />}
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
                <PagePreview p={portfolio} subdomain={subdomain} />
              </div>
              <div className="p-6 sm:p-8">
                <h1 className="m-0 text-[26px] leading-tight tracking-[-0.03em] sm:text-[30px]">
                  This portfolio is live
                </h1>
                <p className="m-0 mt-2 max-w-[60ch] text-[14.5px] leading-relaxed text-muted">
                  Anyone with the link can read what is live, so the content can’t be edited meanwhile.
                  Unpublish to make changes, then publish again — the addresses stay the same.
                </p>

                {!subdomain && (
                  <p className="m-0 mt-5 rounded-xl px-3.5 py-2.5 text-[13.5px]" style={{ border: "1px solid var(--color-ink)" }}>
                    Your account has no subdomain, so nothing here has an address anyone can open.{" "}
                    <Link href="/account" className="font-medium underline underline-offset-2" style={{ color: "var(--color-ink)" }}>
                      Choose a subdomain
                    </Link>
                  </p>
                )}

                <div className="mt-5 flex flex-col gap-3">
                  <Row
                    name="Page"
                    live={pageLive}
                    url={subdomain ? liveUrl(subdomain, portfolio.slug) : ""}
                    publishLabel="Publish page"
                    onPublish={() => updatePortfolio(portfolio.id, (prev) => ({ ...prev, status: "live" }))}
                    onUnpublish={() => updatePortfolio(portfolio.id, (prev) => ({ ...prev, status: "draft" }))}
                  />
                  <Row
                    name="Resume"
                    live={resumeLive}
                    url={subdomain ? resumeUrl(subdomain, portfolio.slug) : ""}
                    publishLabel="Publish resume"
                    onPublish={() => setDialog("publish-resume")}
                    onUnpublish={() => updatePortfolio(portfolio.id, (prev) => ({ ...prev, resumeStatus: "draft" }))}
                  >
                    <a
                      href={resumePrintPath(portfolio.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost"
                      style={SMALL}
                    >
                      Download PDF
                    </a>
                    <div className="flex basis-full flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                      <span className="min-w-0 flex-1">
                        <span className="text-muted">Contact details · </span>
                        {shown.length ? shown.join(", ") : "none shown"}
                      </span>
                      <button
                        type="button"
                        className="cursor-pointer font-medium underline underline-offset-2"
                        style={{ color: "var(--color-ink)" }}
                        onClick={() => setDialog("contact")}
                      >
                        Edit
                      </button>
                    </div>
                  </Row>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary" onClick={unpublish}>
                    Unpublish to edit
                  </button>
                  <a href={previewHref(portfolio)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                    <Icon d={ICON.eye} size={14} />
                    Preview
                  </a>
                  <Link href={`/stats?p=${portfolio.id}`} className="btn btn-ghost">
                    Views and clicks
                  </Link>
                </div>
              </div>
            </TiltPanel>
          </motion.div>
        </main>
      </div>
      <AnimatePresence>
        {dialog && (
          <PublishDialog
            key={dialog}
            p={portfolio}
            contactOnly={dialog === "contact"}
            only={dialog === "publish-resume" ? "resume" : undefined}
            onClose={() => setDialog(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

const SMALL = { marginTop: 0, minHeight: 30, padding: "0.3rem 0.6rem", fontSize: 13 } as const;

/**
 * One public thing and its address. Live: the address, Copy link and its own
 * Unpublish, then whatever else belongs to it (`children`). Not live: the
 * one button that publishes it.
 */
function Row({
  name,
  live,
  url,
  publishLabel,
  onPublish,
  onUnpublish,
  children,
}: {
  name: string;
  live: boolean;
  url: string;
  publishLabel: string;
  onPublish: () => void;
  onUnpublish: () => void;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2.5 rounded-xl px-3.5 py-2.5"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}
    >
      <span className="w-[64px] flex-none text-[13px] font-medium">{name}</span>
      {live ? (
        <>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 flex-1 basis-[160px] items-center gap-1.5 font-mono text-[13px] underline-offset-2 hover:underline"
              style={{ color: "var(--color-ink)" }}
            >
              <span className="truncate">{displayUrl(url)}</span>
              <span className="flex-none">
                <Icon d={ICON.out} size={12} />
              </span>
            </a>
          ) : (
            <span className="min-w-0 flex-1 text-[13px] text-muted">No address yet</span>
          )}
          {url && (
            <button
              type="button"
              className="btn btn-ghost"
              style={SMALL}
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
          )}
          {children}
          <button type="button" className="btn btn-secondary" style={SMALL} onClick={onUnpublish}>
            Unpublish
          </button>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 text-[13px] text-muted">Not public</span>
          <button type="button" className="btn btn-secondary" style={SMALL} onClick={onPublish}>
            {publishLabel}
          </button>
        </>
      )}
    </div>
  );
}
