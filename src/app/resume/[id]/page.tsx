import { Suspense } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { ResumePrint } from "@/components/resume/ResumePrint";

export const metadata = {
  title: "Resume · Facet",
};

export default async function ResumePage({ params }: PageProps<"/resume/[id]">) {
  const { id } = await params;
  return (
    // ?print= is read on the client, so this needs a boundary.
    <Suspense fallback={null}>
      <AuthGuard>
        <ResumePrint id={id} />
      </AuthGuard>
    </Suspense>
  );
}
