import { Suspense } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { PrintAll } from "@/components/PrintAll";

export default function PrintPage() {
  return (
    // ?p= and ?auto= are read on the client, so this needs a boundary.
    <Suspense fallback={<div className="p-10">Loading…</div>}>
      <AuthGuard>
        <PrintAll />
      </AuthGuard>
    </Suspense>
  );
}
