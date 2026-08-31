"use client";

import Link from "next/link";
import { useEffect } from "react";
import { recordView } from "@/lib/analytics";
import { usePortfolios } from "@/lib/store";
import { PublishedBody } from "./themes";

export function PublishedPage({ slug }: { slug: string }) {
  const { getBySlug, ready } = usePortfolios();
  const p = getBySlug(slug);
  const exists = Boolean(p);

  // A visit to a real page is one view. recordView de-dupes per page load, so
  // StrictMode's double effect in development does not count twice.
  useEffect(() => {
    if (exists) recordView(slug);
  }, [exists, slug]);

  if (!p) {
    return (
      <div className="p-10">
        <h2>{ready ? `No page at facet.page/${slug}` : "Loading…"}</h2>
        {ready && <Link href="/">← Back to portfolios</Link>}
      </div>
    );
  }

  return <PublishedBody p={p} />;
}
