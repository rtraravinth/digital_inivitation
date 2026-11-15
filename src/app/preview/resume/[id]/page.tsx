import { Suspense } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { ResumePrint } from "@/components/resume/ResumePrint";

// The owner's resume: a watermarked preview while it is a draft, the PDF
// (`?print=1` opens the print dialog) once it is published. Every resume
// Preview and Download PDF in the app points here (`resumePrintPath()`).

export const metadata = {
  title: "Resume · Facet",
};

export default async function ResumePage({ params }: PageProps<"/preview/resume/[id]">) {
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
