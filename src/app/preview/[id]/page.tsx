import { Suspense } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { DraftPreview } from "@/components/published/DraftPreview";

// The owner's preview of their own page, live or not. The public address
// (/p/<handle>/<slug>) exists only once a portfolio is published, so every
// Preview button in the app points here instead.

export default async function PreviewPage({ params }: PageProps<"/preview/[id]">) {
  const { id } = await params;
  return (
    <AuthGuard>
      {/* useSearchParams (the ?section= entry view) needs a boundary to fall
          back to while the client bundle is still arriving. */}
      <Suspense fallback={<div className="p-10">Loading…</div>}>
        <DraftPreview id={id} />
      </Suspense>
    </AuthGuard>
  );
}
