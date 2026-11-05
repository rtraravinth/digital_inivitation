import { Suspense } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Editor } from "@/components/Editor";

export default async function EditorPage({ params }: PageProps<"/editor/[id]">) {
  const { id } = await params;
  return (
    // ?view= is read on the client, so this needs a boundary.
    <Suspense fallback={null}>
      <AuthGuard>
        <Editor id={id} />
      </AuthGuard>
    </Suspense>
  );
}
