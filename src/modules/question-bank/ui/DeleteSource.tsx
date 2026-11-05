"use client";
import { useRouter } from "next/navigation";

export default function DeleteSource({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <button
      className="text-[13px] text-lead hover:text-red-700"
      onClick={async () => {
        if (!confirm(`"${name}" kaynağı silinsin mi? Kesilmiş sorular havuzda kalır.`)) return;
        const res = await fetch(`/api/kurum/soru-havuzu/kaynaklar/${id}`, { method: "DELETE" });
        if (!res.ok) alert((await res.json().catch(() => ({}))).error ?? "Silinemedi.");
        router.refresh();
      }}
    >
      Sil
    </button>
  );
}
