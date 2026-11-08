import KurumShell from "@/shared/ui/KurumShell";
import QuickAdd from "@/app/kurum/_ui/QuickAdd";
import { requireUser } from "@/modules/identity/server";

export default async function KurumLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <KurumShell user={user} add={<QuickAdd />} addCompact={<QuickAdd compact />}>{children}</KurumShell>;
}
