import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Published } from "@/lib/published";
import { PublishedPage } from "./PublishedPage";

/**
 * What `/p/<subdomain>/<slug>` and `/d/<domain>/<slug>` both render once
 * they know whose page it is. Nothing is drawn around the page — the owner
 * opening it in a new tab sees exactly what a visitor sees.
 */

export function publishedMetadata(published: Published | null): Metadata {
  if (!published) return { title: "No page here · Facet" };

  const { portfolio, privacy } = published;
  return {
    title: portfolio.header.name || portfolio.name,
    description: portfolio.header.current || portfolio.header.description || undefined,
    // The "let search engines index my pages" switch, finally doing what it
    // says. A client-rendered page could not emit this at all.
    robots: privacy.noindex ? { index: false, follow: false } : undefined,
  };
}

export async function PublishedRoute({ published, slug }: { published: Published | null; slug: string }) {
  if (!published) notFound();

  // Set by src/proxy.ts, never by the client (it strips any copy): the page
  // arrived on the owner's subdomain or custom domain, where it is /<slug>.
  const ownHost = !!(await headers()).get("x-facet-host");

  return (
    // useSearchParams (the ?section= entry view) needs a boundary to fall
    // back to while the client bundle is still arriving.
    <Suspense fallback={<div className="p-10">Loading…</div>}>
      <PublishedPage
        subdomain={published.subdomain}
        ownHost={ownHost}
        slug={slug}
        portfolio={published.portfolio}
        privacy={published.privacy}
      />
    </Suspense>
  );
}
