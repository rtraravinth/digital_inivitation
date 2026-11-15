import { redirect } from "next/navigation";

// The resume moved to /preview/resume/<id>; links made before that (and a
// bookmarked ?print=1) still land.
export default async function OldResume({ params, searchParams }: PageProps<"/resume/[id]">) {
  const { id } = await params;
  const { print } = await searchParams;
  redirect(`/preview/resume/${id}${print === "1" ? "?print=1" : ""}`);
}
