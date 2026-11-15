import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PublicResume } from "@/components/resume/PublicResume";
import { fetchPublishedResumeOnDomain } from "@/lib/published";
import { resumeFileName } from "@/lib/resume";

// <custom domain>/<slug>/resume, which src/proxy.ts rewrites to here.

export async function generateMetadata({
  params,
}: PageProps<"/d/[domain]/[slug]/resume">): Promise<Metadata> {
  const { domain, slug } = await params;
  const p = await fetchPublishedResumeOnDomain(domain, slug);
  return { title: p ? resumeFileName(p) : "Resume", robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<"/d/[domain]/[slug]/resume">) {
  const { domain, slug } = await params;
  const p = await fetchPublishedResumeOnDomain(domain, slug);
  if (!p) notFound();
  return (
    <Suspense fallback={null}>
      <PublicResume p={p} />
    </Suspense>
  );
}
