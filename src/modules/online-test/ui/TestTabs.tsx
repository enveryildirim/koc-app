"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TestTabs({ id }: { id: string }) {
  const path = usePathname();
  const tabs = [
    ["duzenle", "Sorular & Ayarlar"],
    ["sonuclar", "Sonuçlar"],
    ["optik", "Optik Form"],
  ];
  return (
    <div className="mt-6 flex gap-1 border-b border-rule">
      {tabs.map(([slug, label]) => {
        const active = path.includes(`/${slug}`);
        return (
          <Link
            key={slug}
            href={`/sinav/${id}/${slug}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${active ? "border-brand-600 text-brand-700" : "border-transparent text-lead hover:text-graphite"}`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
