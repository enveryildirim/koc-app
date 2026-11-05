import KurumShell from "@/shared/ui/KurumShell";
import { requireUser } from "@/modules/identity/server";

export default async function KurumLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <KurumShell user={user}>{children}</KurumShell>;
}
