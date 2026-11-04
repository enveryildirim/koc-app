"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Menü işe göre gruplanır; aktif madde doldurulmuş bir cevap baloncuğuyla gösterilir. */
const GROUPS: { title: string; links: [string, string][] }[] = [
  { title: "Bugün", links: [["/kurum", "Özet"], ["/kurum/yoklama", "Yoklama"]] },
  { title: "Öğrenciler", links: [["/kurum/ogrenciler", "Öğrenci listesi"], ["/kurum/odevler", "Ödev takibi"], ["/kurum/veli-karnesi", "Veli karnesi"]] },
  { title: "Sınavlar", links: [["/kurum/denemeler", "Denemeler ve optik"], ["/panel", "Online testler"]] },
  { title: "Planlama", links: [["/kurum/takvim", "Yıllık takvim"], ["/kurum/ders-programi", "Ders programı"]] },
  { title: "Raporlar", links: [["/kurum/analiz", "Analiz ve uyarılar"], ["/kurum/raporlar", "Devam raporları"]] },
];

export default function KurumNav() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/kurum" ? path === href : path.startsWith(href));
  return (
    <nav aria-label="Kurum menüsü" className="no-print flex gap-1 overflow-x-auto lg:flex-col lg:gap-5 lg:overflow-visible">
      {GROUPS.map((g) => (
        <div key={g.title} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
          <div className="hidden px-2 pb-1 text-[13px] text-lead lg:block">{g.title}</div>
          {g.links.map(([href, label]) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`group flex shrink-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-[15px] ${
                  active ? "bg-white font-semibold text-graphite ring-1 ring-rule" : "text-graphite/80 hover:bg-white/70 hover:text-graphite"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-2.5 shrink-0 rounded-full border-[1.5px] ${
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
