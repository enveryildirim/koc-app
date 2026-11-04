import KurumNav from "@/shared/ui/KurumNav";
import { requireOwner } from "@/modules/identity/server";

export default async function KurumLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[210px_1fr] print:block print:max-w-none print:p-0">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <KurumNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
