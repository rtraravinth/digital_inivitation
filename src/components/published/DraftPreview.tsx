"use client";

import Link from "next/link";
import { useAccount } from "@/lib/account";
import { usePortfolios } from "@/lib/store";
import type { PublishedPrivacy } from "@/lib/published";
import type { Portfolio } from "@/lib/types";
import {
  PreviewProvider,
  PrivacyProvider,
  PublishedBody,
  PublishedHandleProvider,
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
 */
export function DraftPreview({ id }: { id: string }) {
  const { ready, getPortfolio } = usePortfolios();
  const { account } = useAccount();
  const portfolio = getPortfolio(id);

  if (!portfolio) {
    return (
      <div className="p-10">
        <h2>{ready ? "That portfolio doesn't exist." : "Loading…"}</h2>
        {ready && <Link href="/">← Back to portfolios</Link>}
      </div>
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
  const shown: Portfolio = {
    ...portfolio,
    header: privacy.showContact
      ? portfolio.header
      : { ...portfolio.header, links: [] },
    sections: portfolio.sections.filter((s) => !s.hidden),
  };

  return (
    <PreviewProvider value>
      <PrivacyProvider value={privacy}>
        <PublishedHandleProvider value={account.profile.handle}>
          <PublishedBody p={shown} />
        </PublishedHandleProvider>
      </PrivacyProvider>
    </PreviewProvider>
  );
}
