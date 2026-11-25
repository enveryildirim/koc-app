import Link from "next/link";
import { allowRegistration, getUser } from "@/modules/identity/server";
import { AnswerRow } from "./Logo";

export default async function SiteHeader() {
  const user = await getUser();
  return (
    <header className="no-print sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          <AnswerRow />
          <span className="hidden font-display text-xl font-semibold [font-stretch:80%] min-[400px]:inline">SınavKur</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          {user ? (
            <>
              <Link href="/kurum" className="btn-secondary whitespace-nowrap">
                <span className="sm:hidden">Panel</span>
                <span className="hidden sm:inline">Kurum paneline dön</span>
              </Link>
              <form action="/api/auth/logout" method="post" className="hidden sm:block">
                <button className="btn text-lead hover:text-graphite">Çıkış yap</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/giris" className="btn whitespace-nowrap text-graphite hover:bg-white">Giriş yap</Link>
              {allowRegistration() && (
                <Link href="/kayit" className="btn-primary whitespace-nowrap">
                  <span className="sm:hidden">Hesap açın</span>
                  <span className="hidden sm:inline">Kurum hesabı açın</span>
                </Link>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
