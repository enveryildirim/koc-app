import Link from "next/link";
import KurumNav from "@/shared/ui/KurumNav";
import Logo from "@/shared/ui/Logo";
import { requireUser } from "@/modules/identity/server";

export default async function KurumLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[236px_1fr] print:block">
      <aside className="no-print border-b border-rule px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-8 lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
        <div className="mb-3 flex items-center justify-between lg:mb-0 lg:block">
          <Link href="/kurum" className="block px-2">
            <Logo sub={user.name} />
          </Link>
          <form action="/api/auth/logout" method="post" className="lg:hidden">
            <button className="btn px-2 text-lead hover:text-graphite">Çıkış yap</button>
          </form>
        </div>
        <div className="lg:flex-1 lg:overflow-y-auto">
          <KurumNav />
        </div>
        <div className="hidden border-t border-rule px-2 pt-4 text-sm lg:block">
          <div className="truncate text-lead" title={user.email}>{user.email}</div>
          <form action="/api/auth/logout" method="post">
            <button className="mt-1 font-semibold text-graphite hover:text-ink">Çıkış yap</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 px-4 py-6 sm:px-8 lg:py-8 print:p-0">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </div>
    </div>
  );
}
