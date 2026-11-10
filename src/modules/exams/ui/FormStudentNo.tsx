"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Sınavın optik form ayarı: öğrenci numarası alanı var / yok. Kitapçık, form sayfası ve okuyucu aynı ayarı kullanır.
 * Numara yoksa okuturken her formun öğrencisi listeden seçilir; kişisel formda numara her durumda şeritten okunur.
 */
export default function FormStudentNo({ examId, on, compact = false }: { examId: string; on: boolean; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function set(v: boolean) {
    if (v === on || busy) return;
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/kurum/denemeler/${examId}/form-ayar`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentNo: v }) });
    setBusy(false);
    if (!res.ok) return setErr("Kaydedilemedi.");
    router.refresh();
  }
  const pill = (active: boolean) =>
    `px-2.5 py-1 text-[13px] ${active ? "bg-graphite font-semibold text-surface" : "text-lead hover:text-graphite"} ${busy ? "opacity-60" : ""}`;
  return (
    <div className={compact ? "inline-flex items-center gap-2" : ""}>
      <span className={compact ? "text-[13px] text-lead" : "label"}>Öğrenci numarası alanı</span>
      <div className="inline-flex overflow-hidden rounded-md ring-1 ring-rule" role="group" aria-label="Öğrenci numarası alanı">
        <button type="button" aria-pressed={on} className={pill(on)} onClick={() => set(true)}>Var</button>
        <button type="button" aria-pressed={!on} className={pill(!on)} onClick={() => set(false)}>Yok</button>
      </div>
      {!compact && (
        <p className="mt-1 text-xs text-lead">
          {on ? "Öğrenci numarasını kodlar; okuyucu öğrenciyi numaradan bulur." : "Formda numara alanı yok; okuturken her formun öğrencisi listeden seçilir."}
        </p>
      )}
      {err && <span className="ml-2 text-xs text-red-700">{err}</span>}
    </div>
  );
}
