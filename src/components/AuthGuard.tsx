"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { PageState } from "./ui";

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

  if (status === "loading") return <PageState busy title="Loading…" />;
  if (status === "out") return <PageState busy title="Taking you to sign in…" />;

  return <>{children}</>;
}
