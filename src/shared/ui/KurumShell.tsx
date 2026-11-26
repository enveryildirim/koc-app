import Link from "next/link";
import KurumNav, { KurumMobileBar } from "./KurumNav";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

/**
 * Kurum panelinin çerçevesi: solda gruplu kenar çubuğu (telefonda üst çubuk), sağda sayfa.
 * /kurum düzeni kullanır; kullanıcıyı çağıran düzen verir.
 */
type ShellUser = { name: string; email: string; staff?: { name: string } | null };

/** `add` / `addCompact`: kenar çubuğu ve telefon üst çubuğundaki araçlar (arama); düzen verir. */
export default function KurumShell({ user, children, add, addCompact }: { user: ShellUser; children: React.ReactNode; add?: React.ReactNode; addCompact?: React.ReactNode }) {
  // Etüt mesulü kendi adıyla görünür ve kendi ders ekranına geçebilir
  const who = user.staff ? `${user.staff.name} · etüt mesulü` : user.email;
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[208px_1fr] print:block">
      <KurumMobileBar org={user.name} email={who} add={addCompact} />
      <aside className="no-print hidden border-r border-rule bg-sidebar px-3 py-3 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-3">
        <Link href="/kurum" className="block px-2">
          <Logo sub={user.name} />
        </Link>
        {add && <div className="px-1">{add}</div>}
        <div className="flex-1 overflow-y-auto">
          <KurumNav />
        </div>
        {/* Tek satır: kim + çıkış (menü küçük ekranda da sığsın diye) */}
        <div className="border-t border-rule px-2 pt-2 text-[13px]">
          {user.staff && <Link href="/ogretmen" className="block font-semibold text-brand-600">Derslerim</Link>}
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-lead" title={who}>{who}</span>
            <ThemeToggle className="-my-1 shrink-0" />
            <form action="/api/auth/logout" method="post">
              <button className="shrink-0 font-semibold text-graphite hover:text-ink">Çıkış</button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0 px-4 py-4 sm:px-6 lg:py-5 print:p-0">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </div>
    </div>
  );
}
