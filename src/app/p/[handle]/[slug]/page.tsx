import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPublished } from "@/lib/published";
import { PublishedPage } from "@/components/published/PublishedPage";

// facet.page/<handle>/<slug>. Nothing is drawn around the page — the owner
// previewing it opens this in a new tab and sees exactly what a visitor
// sees, which is the only preview worth having.

export async function generateMetadata({
  params,
}: PageProps<"/p/[handle]/[slug]">): Promise<Metadata> {
  const { handle, slug } = await params;
  const published = await fetchPublished(handle, slug);

  if (!published) return { title: "No page here · FACET" };

  const { portfolio, privacy } = published;
  return {
    title: portfolio.header.name || portfolio.name,
    description: portfolio.header.current || portfolio.header.description || undefined,
    // The "let search engines index my pages" switch, finally doing what it
    // says. A client-rendered page could not emit this at all.
    robots: privacy.noindex ? { index: false, follow: false } : undefined,
  };
}

export default async function Page({ params }: PageProps<"/p/[handle]/[slug]">) {
  const { handle, slug } = await params;
  const published = await fetchPublished(handle, slug);

  if (!published) notFound();

  return (
    // useSearchParams (the ?section= entry view) needs a boundary to fall
    // back to while the client bundle is still arriving.
    <Suspense fallback={<div className="p-10">Loading…</div>}>
      <PublishedPage
        handle={handle}
        slug={slug}
        portfolio={published.portfolio}
        privacy={published.privacy}
      />
    </Suspense>
  );
}
