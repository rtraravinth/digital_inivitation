import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPublished } from "@/lib/published";
import { PublishedPage } from "@/components/published/PublishedPage";

// Catch-all: page addresses nest, e.g. facet.page/rohan/investors.

export async function generateMetadata({
  params,
}: PageProps<"/p/[...slug]">): Promise<Metadata> {
  const { slug } = await params;
  const published = await fetchPublished(slug.join("/"));

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

export default async function Page({ params }: PageProps<"/p/[...slug]">) {
  const { slug } = await params;
  const published = await fetchPublished(slug.join("/"));

  if (!published) notFound();

  return (
    // useSearchParams (the ?section= entry view) needs a boundary to fall
    // back to while the client bundle is still arriving.
    <Suspense fallback={<div className="p-10">Loading…</div>}>
      <PublishedPage
        slug={slug.join("/")}
        portfolio={published.portfolio}
        privacy={published.privacy}
      />
    </Suspense>
  );
}
