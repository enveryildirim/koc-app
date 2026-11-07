import Link from "next/link";
import { institutionName, requireStaff } from "@/modules/identity/server";
import { AnswerRow } from "@/shared/ui/Logo";

/** Öğretmen ekranı çerçevesi: telefona göre dar sütun, üstte kim olduğu ve çıkış. */
export default async function OgretmenLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  const org = await institutionName(me.ownerId);
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-10 border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
          <Link href="/ogretmen" className="flex items-center gap-2 text-graphite">
            <AnswerRow size={8} className="text-brand-600" />
          </Link>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-semibold">{me.name}</div>
            <div className="truncate text-[12.5px] text-lead">{me.role === "MENTOR" ? "Etüt mesulü" : "Öğretmen"} · {org}</div>
          </div>
          {me.role === "MENTOR" && (
            <Link href="/kurum" className="btn-secondary px-2.5 py-1 text-[13px]">Yönetim</Link>
          )}
          <form action="/api/auth/logout" method="post">
            <button className="px-1 text-[13px] font-semibold text-lead hover:text-graphite">Çıkış</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-3 py-3 sm:px-4">{children}</main>
    </div>
  );
}
