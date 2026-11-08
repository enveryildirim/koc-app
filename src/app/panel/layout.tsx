import KurumShell from "@/shared/ui/KurumShell";
import { BarTools, SidebarTools } from "@/app/kurum/_ui/ShellTools";
import { requireUser } from "@/modules/identity/server";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <KurumShell user={user} add={<SidebarTools />} addCompact={<BarTools />}>{children}</KurumShell>;
}
