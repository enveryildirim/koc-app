"use client";
import { useRouter } from "next/navigation";

/** Değerlendirmeyi ve puanlarını siler, sonra `backHref`'e döner. */
export default function DeleteAssessment({ id, backHref }: { id: string; backHref: string }) {
  const router = useRouter();
  return (
    <button
      className="text-sm text-lead/70 hover:text-red-600"
      onClick={async () => {
        if (!confirm("Değerlendirme ve girilmiş bütün puanları silinsin mi?")) return;
        const res = await fetch(`/api/kurum/degerlendirme/${id}`, { method: "DELETE" });
        if (!res.ok) return alert((await res.json().catch(() => ({}))).error ?? "Silinemedi.");
        router.push(backHref);
        router.refresh();
      }}
    >
      Değerlendirmeyi sil
    </button>
  );
}
