import { AuthGuard } from "@/components/AuthGuard";
import { Account } from "@/components/Account";

export default function AccountPage() {
  return (
    <AuthGuard>
      <Account />
    </AuthGuard>
  );
}
