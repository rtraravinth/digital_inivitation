import { AuthGuard } from "@/components/AuthGuard";
import { Editor } from "@/components/Editor";

export default async function EditorPage({ params }: PageProps<"/editor/[id]">) {
  const { id } = await params;
  return (
    <AuthGuard>
      <Editor id={id} />
    </AuthGuard>
  );
}
