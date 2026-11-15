import { redirect } from "next/navigation";

// The page preview moved to /preview/page/<id> when the resume got its own
// preview beside it; links made before that still land.
export default async function OldPreview({ params }: PageProps<"/preview/[id]">) {
  const { id } = await params;
  redirect(`/preview/page/${id}`);
}
