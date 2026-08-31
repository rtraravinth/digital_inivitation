import { Editor } from "@/components/Editor";

export default async function EditorPage({ params }: PageProps<"/editor/[id]">) {
  const { id } = await params;
  return <Editor id={id} />;
}
