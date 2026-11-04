"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/kurum", "📊", "Özet"],
  ["/kurum/ogrenciler", "🎓", "Öğrenciler"],
  ["/kurum/denemeler", "📝", "Denemeler & Optik"],
  ["/kurum/analiz", "🔎", "Analiz & Uyarılar"],
  ["/kurum/odevler", "📚", "Ödev Takip"],
  ["/kurum/takvim", "📅", "Yıllık Takvim"],
  ["/kurum/ders-programi", "🗓️", "Ders Programı"],
  ["/kurum/yoklama", "✅", "Yoklama"],
  ["/kurum/raporlar", "📈", "Devam Raporları"],
  ["/kurum/veli-karnesi", "👪", "Veli Karnesi"],
  ["/panel", "💻", "Online Testler"],
];

export default function KurumNav() {
  const path = usePathname();
  return (
    <nav className="no-print flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map(([href, icon, label]) => {
        const active = href === "/kurum" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-white hover:text-slate-900"}`}
          >
            <span>{icon}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
