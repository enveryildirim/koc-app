"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Drift = { section: string; no: number; was: string; now: string };

/**
 * Havuzda cevabı sonradan değişen sorular: anahtardaki ve havuzdaki cevap yan yana; "Anahtarı güncelle" anahtarı havuza
 * eşitler (diğer kitapçıklar eşlemeden), sonuçlar yeniden puanlanır. Anahtar bilerek farklı tutulduysa uyarı görmezden gelinebilir.
 */
export default function KeySync({ examId, drift, results, multi }: { examId: string; drift: Drift[]; results: number; multi: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function sync() {
    if (results && !confirm(`Anahtar güncellenince ${results} sonuç yeniden puanlanır. Devam edilsin mi?`)) return;
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/kurum/denemeler/${examId}/anahtar-esitle`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return setErr("Güncellenemedi.");
    router.refresh();
  }
  return (
    <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200" role="status">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <b>Soru havuzunda cevabı değişen {drift.length} soru var.</b>
        <button type="button" className="btn-secondary px-2.5 py-1 text-[13px]" disabled={busy} onClick={sync}>
          {busy ? "Güncelleniyor…" : "Anahtarı güncelle"}
        </button>
        {err && <span className="text-xs text-red-700">{err}</span>}
      </div>
      <p className="mt-1 text-[13px]">
        {drift.slice(0, 8).map((d, i) => (
          <span key={i}>
            {i > 0 && " · "}
            {multi ? `${d.section} ` : ""}
            {d.no}. soru: anahtarda <b>{d.was || "boş"}</b>, havuzda <b>{d.now}</b>
          </span>
        ))}
        {drift.length > 8 && ` · +${drift.length - 8}`}
      </p>
      <p className="mt-0.5 text-xs text-amber-800">
        Numaralar A kitapçığına göre.{results ? " Güncellenince sonuçlar yeni anahtarla yeniden puanlanır." : ""} Anahtarı bilerek farklı tuttuysanız bu uyarıyı görmezden gelebilirsiniz.
      </p>
    </div>
  );
}
