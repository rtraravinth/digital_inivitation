import type { Metadata } from "next";
import { fetchPublishedOnDomain } from "@/lib/published";
import { PublishedRoute, publishedMetadata } from "@/components/published/PublishedRoute";

// <custom domain>/<slug>, which src/proxy.ts rewrites to here. The API says
// whose domain it is, and only once its owner has verified it.

export async function generateMetadata({ params }: PageProps<"/d/[domain]/[slug]">): Promise<Metadata> {
  const { domain, slug } = await params;
  return publishedMetadata(await fetchPublishedOnDomain(domain, slug));
}

export default async function Page({ params }: PageProps<"/d/[domain]/[slug]">) {
  const { domain, slug } = await params;
  return <PublishedRoute published={await fetchPublishedOnDomain(domain, slug)} slug={slug} />;
}
