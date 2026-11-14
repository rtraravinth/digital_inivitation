import type { Metadata } from "next";
import { fetchPublished } from "@/lib/published";
import { PublishedRoute, publishedMetadata } from "@/components/published/PublishedRoute";

// <subdomain>.facetfolio.com/<slug>, which src/proxy.ts rewrites to here. With
// no root domain configured, this route is the address itself.

export async function generateMetadata({
  params,
}: PageProps<"/p/[subdomain]/[slug]">): Promise<Metadata> {
  const { subdomain, slug } = await params;
  return publishedMetadata(await fetchPublished(subdomain, slug));
}

export default async function Page({ params }: PageProps<"/p/[subdomain]/[slug]">) {
  const { subdomain, slug } = await params;
  return <PublishedRoute published={await fetchPublished(subdomain, slug)} slug={slug} />;
}
