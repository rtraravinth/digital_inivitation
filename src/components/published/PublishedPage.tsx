"use client";

import { LayoutGroup } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { recordView } from "@/lib/analytics";
import type { PublishedPrivacy } from "@/lib/published";
import { withPlacedLists } from "@/lib/resume";
import type { Portfolio } from "@/lib/types";
import {
  PrivacyProvider,
  PublishedBody,
  PublishedSubdomainProvider,
  SectionDetail,
} from "./themes";

/**
 * The client half of a published page.
 *
 * The content itself is fetched and rendered on the server — this exists for
 * the two things that genuinely need a browser: counting the visit, and the
 * ?section= entry view.
 */
export function PublishedPage({
  subdomain,
  ownHost,
  slug,
  portfolio: raw,
  privacy,
}: {
  subdomain: string;
  /** Served on the owner's subdomain or custom domain, at `/<slug>`. */
  ownHost: boolean;
  slug: string;
  portfolio: Portfolio;
  privacy: PublishedPrivacy;
}) {
  // The structured blocks on the page are sections too, so ?section= can
  // open one of them like any other.
  const portfolio = withPlacedLists(raw);
  const params = useSearchParams();
  const sectionId = params.get("section");

  // One view per page load. The server collapses repeats of the same key, so
  // StrictMode's double effect in development does not count twice — and the
  // owner's "count visits" switch is checked there, not here.
  useEffect(() => {
    recordView(subdomain, slug);
  }, [subdomain, slug]);

  // Artboard 1d: one entry on its own page, reached from any theme's title.
  const section = sectionId
    ? portfolio.sections.find((s) => s.id === sectionId)
    : undefined;

  return (
    <PrivacyProvider value={privacy}>
      <PublishedSubdomainProvider value={subdomain} ownHost={ownHost}>
        {/*
          One `LayoutGroup` across both views, which is what lets the caption
          lift actually lift: the plate in the run and the plate on the detail
          view share a `layoutId`, and because `?section=` only changes this
          route's search params, the React tree survives the navigation and
          the mount travels between the two rather than one disappearing while
          another fades in somewhere else.
        */}
        <LayoutGroup>
          {section ? (
            <SectionDetail p={portfolio} section={section} />
          ) : (
            <PublishedBody p={portfolio} />
          )}
        </LayoutGroup>
      </PublishedSubdomainProvider>
    </PrivacyProvider>
  );
}
