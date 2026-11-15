import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PublicResume } from "@/components/resume/PublicResume";
import { fetchPublishedResume } from "@/lib/published";
import { resumeFileName } from "@/lib/resume";

// <subdomain>.facetfolio.com/<slug>/resume, which src/proxy.ts rewrites to here.

export async function generateMetadata({
  params,
}: PageProps<"/p/[subdomain]/[slug]/resume">): Promise<Metadata> {
  const { subdomain, slug } = await params;
  const p = await fetchPublishedResume(subdomain, slug);
  return { title: p ? resumeFileName(p) : "Resume", robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<"/p/[subdomain]/[slug]/resume">) {
  const { subdomain, slug } = await params;
  const p = await fetchPublishedResume(subdomain, slug);
  if (!p) notFound();
  return (
    // ?print= is read on the client, so this needs a boundary.
    <Suspense fallback={null}>
      <PublicResume p={p} />
    </Suspense>
  );
}
