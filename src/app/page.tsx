import { AuthGuard } from "@/components/AuthGuard";
import { PortfolioList } from "@/components/PortfolioList";

export default function PortfoliosPage() {
  return (
    <AuthGuard>
      <PortfolioList />
    </AuthGuard>
  );
}
