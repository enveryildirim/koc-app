import Link from "next/link";
import KurumNav, { KurumMobileBar } from "./KurumNav";
import Logo from "./Logo";

/**
 * Kurum panelinin çerçevesi: solda gruplu kenar çubuğu (telefonda üst çubuk), sağda sayfa.
 * /kurum, /panel ve /sinav/[id] düzenleri kullanır; kullanıcıyı çağıran düzen verir.
 */
type ShellUser = { name: string; email: string; staff?: { name: string } | null };

/** `add` / `addCompact`: "+ Ekle" düğmesi (kenar çubuğu ve telefon üst çubuğu); düzen verir. */
export default function KurumShell({ user, children, add, addCompact }: { user: ShellUser; children: React.ReactNode; add?: React.ReactNode; addCompact?: React.ReactNode }) {
  // Etüt mesulü kendi adıyla görünür ve kendi ders ekranına geçebilir
  const who = user.staff ? `${user.staff.name} · etüt mesulü` : user.email;
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[208px_1fr] print:block">
      <KurumMobileBar org={user.name} email={who} add={addCompact} />
      <aside className="no-print hidden border-r border-rule bg-sidebar px-3 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-5">
        <Link href="/kurum" className="block px-2">
          <Logo sub={user.name} />
        </Link>
        {add && <div className="px-1">{add}</div>}
        <div className="flex-1 overflow-y-auto">
          <KurumNav />
        </div>
        <div className="border-t border-rule px-2 pt-3 text-[13px]">
          <div className="truncate text-lead" title={who}>{who}</div>
          {user.staff && <Link href="/ogretmen" className="mt-1 block font-semibold text-brand-600">Derslerim</Link>}
          <form action="/api/auth/logout" method="post">
            <button className="mt-1 font-semibold text-graphite hover:text-ink">Çıkış yap</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 px-4 py-4 sm:px-6 lg:py-5 print:p-0">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </div>
    </div>
  );
}
