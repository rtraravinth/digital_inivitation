import { Suspense } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Builder } from "@/components/builder/Builder";

export default async function BuilderPage({ params }: PageProps<"/builder/[id]">) {
  const { id } = await params;
  return (
    // ?mode= is read on the client, so this needs a boundary.
    <Suspense fallback={null}>
      <AuthGuard>
        <Builder id={id} />
      </AuthGuard>
    </Suspense>
  );
}
