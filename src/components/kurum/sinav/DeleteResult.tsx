"use client";
import { useRouter } from "next/navigation";

export default function DeleteResult({ url }: { url: string }) {
  const router = useRouter();
  return (
    <button
      className="text-slate-300 hover:text-red-600"
      title="Sonucu sil"
      onClick={async () => {
        if (!confirm("Bu öğrencinin sonucu silinsin mi?")) return;
        await fetch(url, { method: "DELETE" });
        router.refresh();
      }}
    >
      ✕
    </button>
  );
}
