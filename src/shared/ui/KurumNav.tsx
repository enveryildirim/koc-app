"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnswerRow } from "./Logo";

/**
 * Menü işe göre gruplanır: günlük bilgi girişi ve takibat üstte, yılda birkaç kez yapılan tanımlar ("Kurum") altta.
 * Aktif madde doldurulmuş bir cevap baloncuğuyla gösterilir.
 */
export const GROUPS: { title: string; links: [string, string][] }[] = [
  { title: "Bugün", links: [["/kurum", "Özet"]] },
  { title: "Giriş", links: [["/kurum/yoklama", "Yoklama"], ["/kurum/degerlendirme", "Sözlü ve yazılı"], ["/kurum/odevler", "Ödevler"], ["/kurum/denemeler", "Denemeler ve optik"]] },
  { title: "Takibat", links: [["/kurum/takip", "Takip"], ["/kurum/analiz", "Analiz"], ["/kurum/veli-karnesi", "Veli karnesi"], ["/kurum/veli-bulteni", "Haftalık veli raporu"]] },
  {
    title: "Kurum",
    links: [
      ["/kurum/ogrenciler", "Öğrenciler"], ["/kurum/siniflar", "Sınıflar"], ["/kurum/ogretmenler", "Öğretmenler"], ["/kurum/ders-programi", "Ders programı"],
      ["/kurum/takvim", "Takvim ve planlar"], ["/kurum/mufredat", "Müfredat"], ["/kurum/puan-cetvelleri", "Puan cetvelleri"],
    ],
  },
  { title: "Araçlar", links: [["/kurum/soru-havuzu", "Soru havuzu"], ["/panel", "Online testler"]] },
];

/** Menüde ayrı maddesi olmayan sayfalar: hangi maddenin altında sayılır. */
const ALIASES: Record<string, string[]> = {
  "/panel": ["/sinav/"], // online test düzenleme
  "/kurum/analiz": ["/kurum/raporlar"], // devam raporları Analiz'in sekmesi
  "/kurum/ogretmenler": ["/kurum/ders-programi/ogretmen/"], // öğretmen ayrıntısı
};

function useIsActive() {
  const path = usePathname();
  const isActive = (href: string) => {
    if (href === "/kurum") return path === href;
    if (href === "/kurum/ders-programi" && path.startsWith("/kurum/ders-programi/ogretmen/")) return false;
    return path.startsWith(href) || (ALIASES[href] ?? []).some((p) => path.startsWith(p));
  };
  return { path, isActive };
}

export default function KurumNav() {
  const { isActive } = useIsActive();
  return (
    <nav aria-label="Kurum menüsü" className="no-print flex flex-col gap-2.5">
      {GROUPS.map((g) => (
        <div key={g.title} className="flex flex-col gap-0.5">
          {g.title !== "Bugün" && <div className="px-2 pb-0.5 text-xs text-lead">{g.title}</div>}
          {g.links.map(([href, label]) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`group flex shrink-0 items-center gap-2.5 rounded-md px-2 py-[3px] text-[14px] ${
                  active ? "bg-surface font-semibold text-graphite ring-1 ring-rule" : "text-graphite/80 hover:bg-surface/60 hover:text-graphite"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full border-[1.5px] ${
                    active ? "border-graphite bg-graphite" : "border-ink/45 group-hover:border-graphite"
                  }`}
                />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 * Telefonda kenar çubuğu yerine: kurum adı ve bulunulan sayfa tek satırda, menü düğmesiyle açılan gruplu liste.
 * Sayfa değişince menü kendiliğinden kapanır.
 */
export function KurumMobileBar({ org, email, add }: { org: string; email: string; add?: React.ReactNode }) {
  const { path, isActive } = useIsActive();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  const current = GROUPS.flatMap((g) => g.links).find(([href]) => isActive(href))?.[1];

  return (
    <div className="no-print sticky top-0 z-30 lg:hidden">
      <div className="flex h-12 items-center gap-3 border-b border-rule bg-sidebar/95 px-4 backdrop-blur">
        <Link href="/kurum" aria-label="SınavKur ana sayfa" className="flex items-center gap-2">
          <AnswerRow size={8} />
          <span className="font-display text-[1.05rem] leading-none font-semibold [font-stretch:80%]">SınavKur</span>
        </Link>
        {current && <span className="min-w-0 truncate border-l border-rule pl-3 text-[13.5px] text-lead">{current}</span>}
        {add && <span className="ml-auto">{add}</span>}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="kurum-mobil-menu"
          className={`-mr-2 ${add ? "" : "ml-auto"} inline-flex size-10 items-center justify-center rounded-md text-graphite hover:bg-surface`}
        >
          <span className="sr-only">{open ? "Menüyü kapat" : "Menüyü aç"}</span>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            {open ? (
              <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            ) : (
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <>
          <button type="button" aria-label="Menüyü kapat" onClick={() => setOpen(false)} className="fixed inset-0 top-12 bg-graphite/25" />
          <div id="kurum-mobil-menu" className="absolute inset-x-0 top-12 max-h-[calc(100dvh-3rem)] overflow-y-auto border-b border-rule bg-sidebar px-3 pt-3 pb-4 shadow-lg">
            <div className="px-2 pb-3 text-[13px] text-lead">{org}</div>
            <nav aria-label="Kurum menüsü" className="grid grid-cols-2 gap-x-2 gap-y-3.5">
              {GROUPS.map((g) => (
                <div key={g.title} className="flex flex-col gap-0.5">
                  <div className="px-2 pb-0.5 text-xs text-lead">{g.title}</div>
                  {g.links.map(([href, label]) => {
                    const active = isActive(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-10 items-center gap-2 rounded-md px-2 text-[14px] ${
                          active ? "bg-surface font-semibold ring-1 ring-rule" : "text-graphite/85"
                        }`}
                      >
                        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full border-[1.5px] ${active ? "border-graphite bg-graphite" : "border-ink/45"}`} />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-rule px-2 pt-3 text-[13px]">
              <span className="truncate text-lead">{email}</span>
              <form action="/api/auth/logout" method="post">
                <button className="font-semibold text-graphite">Çıkış yap</button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
