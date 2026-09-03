import { AuthGuard } from "@/components/AuthGuard";
import { BlockManager } from "@/components/BlockManager";

export default async function BlocksPage({ params }: PageProps<"/blocks/[id]">) {
  const { id } = await params;
  return (
    <AuthGuard>
      <BlockManager id={id} />
    </AuthGuard>
  );
}
