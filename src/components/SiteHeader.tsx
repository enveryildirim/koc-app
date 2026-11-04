import Link from "next/link";
import { getUser } from "@/lib/auth";

export default async function SiteHeader() {
  const user = await getUser();
  return (
    <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">✓</span>
          SınavKur
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          {user ? (
            <>
              <Link href="/kurum" className="btn-secondary">Kurum Paneli</Link>
              <span className="hidden text-slate-500 sm:inline">{user.name}</span>
              <form action="/api/auth/logout" method="post">
                <button className="btn text-slate-600 hover:bg-slate-100">Çıkış</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/giris" className="btn text-slate-700 hover:bg-slate-100">Giriş yap</Link>
              <Link href="/kayit" className="btn-primary">Ücretsiz başla</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
