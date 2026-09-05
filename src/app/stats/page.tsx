import { Suspense } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Stats } from "@/components/Stats";

export default function StatsPage() {
  return (
    // ?p= deep-links one page's stats, and useSearchParams needs a boundary.
    <Suspense fallback={<div className="p-10">Loading…</div>}>
      <AuthGuard>
        <Stats />
      </AuthGuard>
    </Suspense>
  );
}
