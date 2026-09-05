"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

function Waiting({ note }: { note: string }) {
  return (
    <main className="mx-auto w-full max-w-[900px] px-6 py-16">
      <p className="mono-label">Facet</p>
      <p className="text-muted mt-2 text-[14px]">{note}</p>
    </main>
  );
}

/**
 * Wraps everything that needs an account. The published page is deliberately
 * not wrapped — it is public, and guarding it would defeat the point of it.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  // Navigation is a side effect, so it belongs here rather than in render.
  // This is not setState-in-useEffect and does not trip the compiler rule.
  useEffect(() => {
    if (status === "out") router.replace("/signin");
  }, [status, router]);

  if (status === "loading") return <Waiting note="Loading…" />;
  if (status === "out") return <Waiting note="Taking you to sign in…" />;

  return <>{children}</>;
}
