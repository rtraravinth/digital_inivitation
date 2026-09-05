import { AuthGuard } from "@/components/AuthGuard";
import { ThemeGallery } from "@/components/builder/ThemeGallery";

export default async function ThemesPage({ params }: PageProps<"/themes/[id]">) {
  const { id } = await params;
  return (
    <AuthGuard>
      <ThemeGallery id={id} />
    </AuthGuard>
  );
}
