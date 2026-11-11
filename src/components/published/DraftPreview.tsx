"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "@/lib/account";
import { usePortfolios } from "@/lib/store";
import type { PublishedPrivacy } from "@/lib/published";
import { withPlacedLists } from "@/lib/resume";
import type { Portfolio } from "@/lib/types";
import { ICON, Icon, PageState, StatusPill } from "../ui";
import {
  PreviewProvider,
  PrivacyProvider,
  PublishedBody,
  PublishedHandleProvider,
  SectionDetail,
} from "./themes";

/**
 * The owner's own preview, at /preview/<id>.
 *
 * `/p/<handle>/<slug>` only exists while a portfolio is live — the API
 * answers 404 for a draft on purpose — so pointing the app's Preview buttons
 * at it meant a dead end for exactly the pages that most need looking at.
 * This renders the same themes from the store instead, so a draft previews
 * like anything else.
 *
 * Two things are copied from the public response rather than assumed: the
 * privacy switches, applied here the way the server applies them, and the
 * absence of analytics — previewing your own page must not count as a visit
 * or a click.
 *
 * `?section=` is answered here the same way the published page answers it,
 * because the themes link to it: a title inside a preview opens that entry's
 * own page (artboard 1d) without leaving the preview.
 */
export function DraftPreview({ id }: { id: string }) {
  const { ready, getPortfolio } = usePortfolios();
  const { account } = useAccount();
  const sectionId = useSearchParams().get("section");
  const portfolio = getPortfolio(id);

  if (!portfolio) {
    return ready ? (
      <PageState title="That portfolio doesn’t exist" note="It may have been deleted, or the link is from another account.">
        <Link href="/" className="btn btn-primary" style={{ marginTop: 0 }}>
          Back to portfolios
        </Link>
      </PageState>
    ) : (
      <PageState busy title="Loading preview…" />
    );
  }

  const privacy: PublishedPrivacy = {
    noindex: !account.privacy.indexable,
    badge: account.privacy.badge,
    showContact: account.privacy.showContact,
  };

  // What the public endpoint would have sent: hidden sections are absent
  // rather than styled away, and the header's links are gone when contact
  // details are hidden. A preview that showed more than a visitor gets would
  // be worse than no preview.
  const shown: Portfolio = withPlacedLists({
    ...portfolio,
    header: privacy.showContact
      ? portfolio.header
      : { ...portfolio.header, links: [] },
    sections: portfolio.sections.filter((s) => !s.hidden),
  });

  // Hidden sections are already gone from `shown`, so a link to one cannot
  // be followed here either — the same answer the published page gives.
  const section = sectionId
    ? shown.sections.find((s) => s.id === sectionId)
    : undefined;

  return (
    <PreviewProvider value>
      <PrivacyProvider value={privacy}>
        <PublishedHandleProvider value={account.profile.handle}>
          {section ? (
            <SectionDetail p={shown} section={section} />
          ) : (
            <PublishedBody p={shown} />
          )}
          <OwnerBar p={portfolio} />
        </PublishedHandleProvider>
      </PrivacyProvider>
    </PreviewProvider>
  );
}

/**
 * The owner's way back out, floating over the page rather than above it so
 * the preview keeps the page's own first screen. It sits outside the
 * published wrapper, so it takes the app's tokens and theme, never the
 * portfolio's ground — and it never prints.
 */
function OwnerBar({ p }: { p: Portfolio }) {
  const reduced = useReducedMotion();
  const link =
    "flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium no-underline transition-colors hover:bg-[var(--color-neutral-200)]";
  return (
    <motion.nav
      aria-label="Preview"
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 26 }}
      className="no-print fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-1 rounded-full p-1"
      style={{
        x: "-50%",
        background: "color-mix(in srgb, var(--color-bg) 88%, transparent)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid var(--color-divider)",
        boxShadow: "var(--shadow-lg)",
        color: "var(--color-ink)",
      }}
    >
      <Link href="/" className={link} style={{ color: "var(--color-ink)" }} aria-label="Back to portfolios">
        <span aria-hidden>←</span>
        <span className="hidden sm:inline">Portfolios</span>
      </Link>
      <span className="flex items-center gap-2 px-2 text-[13px]" style={{ borderLeft: "1px solid var(--color-divider)" }}>
        <span className="hidden font-medium sm:inline">Preview</span>
        <StatusPill live={p.status === "live"} />
      </span>
      <Link href={`/editor/${p.id}`} className={link} style={{ color: "var(--color-ink)" }}>
        <Icon d={ICON.pencil} size={14} />
        Edit
      </Link>
      <Link
        href={`/builder/${p.id}`}
        className={`${link} text-[var(--color-bg)] hover:bg-[var(--color-ink)]`}
        style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
      >
        Builder
      </Link>
    </motion.nav>
  );
}
