"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { recordView } from "@/lib/analytics";
import type { PublishedPrivacy } from "@/lib/published";
import type { Portfolio } from "@/lib/types";
import {
  PrivacyProvider,
  PublishedBody,
  PublishedHandleProvider,
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
  handle,
  slug,
  portfolio,
  privacy,
}: {
  handle: string;
  slug: string;
  portfolio: Portfolio;
  privacy: PublishedPrivacy;
}) {
  const params = useSearchParams();
  const sectionId = params.get("section");

  // One view per page load. The server collapses repeats of the same key, so
  // StrictMode's double effect in development does not count twice — and the
  // owner's "count visits" switch is checked there, not here.
  useEffect(() => {
    recordView(handle, slug);
  }, [handle, slug]);

  // Artboard 1d: one entry on its own page, reached from any theme's title.
  const section = sectionId
    ? portfolio.sections.find((s) => s.id === sectionId)
    : undefined;

  return (
    <PrivacyProvider value={privacy}>
      <PublishedHandleProvider value={handle}>
        {section ? (
          <SectionDetail p={portfolio} section={section} />
        ) : (
          <PublishedBody p={portfolio} />
        )}
      </PublishedHandleProvider>
    </PrivacyProvider>
  );
}
