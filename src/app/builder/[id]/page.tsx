import { AuthGuard } from "@/components/AuthGuard";
import { Builder } from "@/components/builder/Builder";

export default async function BuilderPage({ params }: PageProps<"/builder/[id]">) {
  const { id } = await params;
  return (
    <AuthGuard>
      <Builder id={id} />
    </AuthGuard>
  );
}
