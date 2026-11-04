"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LETTERS, randomKey, shuffleKey } from "@/lib/exam";

type Sec = { name: string; count: number; keyA: string; keyB: string };
type Init = { name: string; date: string; bookletB: boolean; wrongPer: number; sections: Sec[] };

export default function KeyEditor({ examId, initial, choices, hasResults }: { examId: string; initial: Init; choices: number; hasResults: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const allowed = LETTERS.slice(0, choices);

  const setSec = (i: number, p: Partial<Sec>) => setV({ ...v, sections: v.sections.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const clean = (k: string) => k.toUpperCase().replace(/[^A-E]/g, "");

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/kurum/denemeler/${examId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Kaydedilemedi." });
    setMsg({ ok: true, text: hasResults ? "Kaydedildi; tüm sonuçlar yeniden hesaplandı." : "Kaydedildi." });
    router.refresh();
  }

  async function remove() {
    if (!confirm("Deneme ve tüm sonuçları silinsin mi?")) return;
    await fetch(`/api/kurum/denemeler/${examId}`, { method: "DELETE" });
    router.push("/kurum/denemeler");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card grid gap-4 p-5 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">Sınav adı</label>
          <input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Tarih</label>
          <input type="date" className="input" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        </div>
        <div>
          <label className="label">Kaç yanlış 1 doğruyu götürür</label>
          <input type="number" min={0} max={10} className="input" value={v.wrongPer} onChange={(e) => setV({ ...v, wrongPer: Number(e.target.value) })} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-4">
          <input type="checkbox" checked={v.bookletB} onChange={(e) => setV({ ...v, bookletB: e.target.checked })} className="accent-brand-600" />
          B kitapçığı var (optik formda kitapçık türü alanı çıkar)
        </label>
      </div>

      {v.sections.map((s, i) => {
        const keys = v.bookletB ? (["keyA", "keyB"] as const) : (["keyA"] as const);
        return (
          <div key={i} className="card p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <label className="label">Bölüm adı</label>
                <input className="input" value={s.name} onChange={(e) => setSec(i, { name: e.target.value })} />
              </div>
              <div className="w-28">
                <label className="label">Soru sayısı</label>
                <input type="number" min={1} max={120} className="input" value={s.count} onChange={(e) => setSec(i, { count: Number(e.target.value) })} />
              </div>
              {v.sections.length > 1 && (
                <button className="btn-danger" onClick={() => setV({ ...v, sections: v.sections.filter((_, j) => j !== i) })}>Bölümü sil</button>
              )}
            </div>
            {keys.map((k) => {
              const val = s[k];
              const bad = val.split("").some((ch) => !allowed.includes(ch));
              return (
                <div key={k} className="mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="label mb-0">{k === "keyA" ? "A kitapçığı" : "B kitapçığı"} cevap anahtarı</label>
                    <div className="flex gap-2 text-xs">
                      <span className={val.length === s.count && !bad ? "text-emerald-700" : "text-amber-700"}>
                        {val.length}/{s.count} {bad && `· yalnızca ${allowed} kullanılabilir`}
                      </span>
                      {k === "keyB" && s.keyA.length === s.count && (
                        <button className="font-medium text-brand-600" onClick={() => setSec(i, { keyB: shuffleKey(s.keyA, i * 31 + 7) })}>A’dan karıştır</button>
                      )}
                      <button className="font-medium text-brand-600" onClick={() => setSec(i, { [k]: randomKey(s.count, choices) })}>🧪 Rastgele doldur</button>
                    </div>
                  </div>
                  <input
                    className="input mt-1 font-mono tracking-[0.3em]"
                    placeholder={"ör. " + "ABCD".repeat(3)}
                    value={val}
                    maxLength={s.count}
                    onChange={(e) => setSec(i, { [k]: clean(e.target.value) })}
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Array.from({ length: s.count }, (_, q) => (
                      <span key={q} className="flex w-9 flex-col items-center rounded bg-slate-50 py-0.5 text-[10px] text-slate-400">
                        {q + 1}
                        <b className={`text-sm ${val[q] ? "text-slate-800" : "text-slate-300"}`}>{val[q] ?? "·"}</b>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary" onClick={() => setV({ ...v, sections: [...v.sections, { name: "Yeni bölüm", count: 10, keyA: "", keyB: "" }] })}>
          + Bölüm ekle
        </button>
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
        <button className="btn-danger ml-auto" onClick={remove}>Denemeyi sil</button>
      </div>
      <p className="text-xs text-slate-500">
        Anahtarı yayıncının cevap anahtarından kopyalayıp yapıştırabilirsiniz; harf dışındaki karakterler (boşluk, rakam, tire) otomatik temizlenir.
        Bölüm yapısını değiştirirseniz optik formu yeniden yazdırın.
      </p>
    </div>
  );
}
