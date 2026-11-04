"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Plan sayfası düğmeleri: düzenle, başka sınıflara kopyala, sil. */
export default function PlanActions({ planId, classrooms }: { planId: string; classrooms: { id: string; name: string }[] }) {
  const router = useRouter();
  const [copyOpen, setCopyOpen] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      alert(json.error ?? "İşlem başarısız.");
      return null;
    }
    return json;
  }

  async function copy() {
    const r = await call(`/api/kurum/plan/${planId}/kopyala`, "POST", { classroomIds: sel });
    if (!r) return;
    alert(
      [r.created.length ? `Kopyalandı: ${r.created.join(", ")}` : "", r.skipped.length ? `Zaten planı olduğu için atlandı: ${r.skipped.join(", ")}` : ""]
        .filter(Boolean)
        .join("\n") || "Kopyalanacak sınıf yok.",
    );
    setCopyOpen(false);
    setSel([]);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Plan ve tüm konu işaretleri silinsin mi?")) return;
    if (await call(`/api/kurum/plan/${planId}`, "DELETE")) router.push("/kurum/takvim/plan");
  }

  return (
    <>
      <Link href={`/kurum/takvim/plan/${planId}?duzenle=1`} className="btn-secondary">✏️ Düzenle</Link>
      <button className="btn-secondary" onClick={() => setCopyOpen(true)} disabled={!classrooms.length}>Diğer sınıflara kopyala</button>
      <button className="btn-danger" onClick={remove} disabled={busy}>Sil</button>
      {copyOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setCopyOpen(false)}>
          <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Planı kopyala</h2>
            <p className="text-sm text-slate-500">Aynı konular, seçilen sınıfların tatillerine göre yeniden dağıtılır. İşlendi bilgileri kopyalanmaz.</p>
            <div className="mt-4 space-y-1">
              {classrooms.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={sel.includes(c.id)} onChange={(e) => setSel(e.target.checked ? [...sel, c.id] : sel.filter((x) => x !== c.id))} />
                  {c.name}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setCopyOpen(false)}>Vazgeç</button>
              <button className="btn-primary" disabled={busy || !sel.length} onClick={copy}>Kopyala</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
