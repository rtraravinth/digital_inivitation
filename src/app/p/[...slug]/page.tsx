import { PublishedPage } from "@/components/published/PublishedPage";

// Catch-all: page addresses nest, e.g. facet.page/rohan/investors.
export default async function Page({ params }: PageProps<"/p/[...slug]">) {
  const { slug } = await params;
  return <PublishedPage slug={slug.join("/")} />;
}
