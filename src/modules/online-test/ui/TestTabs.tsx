"use client";
import { usePathname } from "next/navigation";
import { Tabs } from "@/shared/ui/kurum";

/** Online test sayfalarının sekmeleri (kurum panelindeki hap sekmelerle aynı görünüm). */
export default function TestTabs({ id }: { id: string }) {
  const path = usePathname();
  const tabs = [
    { key: "duzenle", label: "Sorular ve ayarlar", href: `/sinav/${id}/duzenle` },
    { key: "sonuclar", label: "Sonuçlar", href: `/sinav/${id}/sonuclar` },
    { key: "optik", label: "Optik form", href: `/sinav/${id}/optik` },
  ];
  return <Tabs tabs={tabs} active={tabs.find((t) => path.includes(`/${t.key}`))?.key ?? "duzenle"} />;
}
