"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Çözümleri yayınla / kapat. Kitapçıktaki ve karnedeki QR'lar yayınlanana kadar "henüz açılmadı" sayfasını gösterir.
 * Açıkken çözüm sayfasının bağlantısı da verilir (öğretmen kontrol etsin, isterse paylaşsın).
 */
export default function SolutionsToggle({ examId, open, url }: { examId: string; open: boolean; url: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function set(v: boolean) {
    if (busy) return;
    if (v && !confirm("Çözümler yayınlansın mı? Kitapçıktaki ve karnelerdeki QR okutulunca cevaplar ve çözümler görünür.")) return;
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/kurum/denemeler/${examId}/cozum`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ open: v }) });
    setBusy(false);
    if (!res.ok) return setErr("Kaydedilemedi.");
    router.refresh();
  }
  if (!open)
    return (
      <span className="inline-flex items-center gap-2">
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => set(true)} title="Kitapçıktaki ve karnelerdeki QR'lar çözüm sayfasını açar. Yayınlanana kadar sayfa kapalıdır.">
          Çözümleri yayınla
        </button>
        {err && <span className="text-xs text-red-700">{err}</span>}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2 py-1 text-[13px] text-emerald-800 ring-1 ring-emerald-200">
      Çözümler açık
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="font-semibold underline">
          Sayfa
        </a>
      )}
      <button type="button" className="text-lead underline hover:text-graphite" disabled={busy} onClick={() => set(false)}>
        Kapat
      </button>
      {err && <span className="text-xs text-red-700">{err}</span>}
    </span>
  );
}
