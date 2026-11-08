"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { gradeLabel } from "../index";

type Row = { unit: string; topic: string; code: string; outcome: string; weeks: number };

/**
 * Bir (ders, düzey) setinin konularını tablo olarak düzenler: satır ekleme, silme, sıralama.
 * Yeni sette ders kurumdaki derslerden, düzey kurumun sınıf düzeylerinden seçilir (müfredat ders açmaz).
 * Kaydet setin tamamını yazar.
 */
export default function CurriculumEditor({
  subject,
  grade,
  rows: initial,
  courseNames = [],
  grades = [],
}: {
  subject?: string;
  grade?: string;
  rows: Row[];
  /** Kurumdaki ders adları (Yönetim → Dersler) */
  courseNames?: string[];
  /** Düzey seçenekleri (`curriculumGradeOptions`) */
  grades?: string[];
}) {
  const router = useRouter();
  const isNew = !subject;
  const [meta, setMeta] = useState({ subject: subject ?? "", grade: grade ?? grades[0] ?? "" });
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [{ unit: "", topic: "", code: "", outcome: "", weeks: 1 }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (i: number, p: Partial<Row>) => setRows((l) => l.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const move = (i: number, d: number) =>
    setRows((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const c = [...l];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  async function save() {
    const list = rows.filter((r) => r.topic.trim() || r.unit.trim() || r.code.trim());
    if (!meta.subject.trim()) return setMsg({ ok: false, text: "Ders seçin." });
    if (!meta.grade) return setMsg({ ok: false, text: "Düzey seçin." });
    if (!list.length) return setMsg({ ok: false, text: "En az bir konu girin." });
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/kurum/mufredat", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: meta.subject, grade: meta.grade, rows: list }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Kaydedilemedi." });
    setMsg({ ok: true, text: `${json.saved} konu kaydedildi.` });
    router.push(`/kurum/mufredat?ders=${encodeURIComponent(meta.subject.trim())}&sinif=${encodeURIComponent(meta.grade)}&sekme=duzenle`);
    router.refresh();
  }

  async function removeSet() {
    if (!confirm(`${meta.subject} · ${gradeLabel(meta.grade)} müfredatı silinsin mi? Yıllık planlar, havuz soruları ve denemeler etkilenmez.`)) return;
    await fetch("/api/kurum/mufredat", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meta) });
    router.push("/kurum/mufredat");
    router.refresh();
  }

  return (
    <div>
      {isNew && (
        <div className="card mb-3 px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-48 flex-1">
              <span className="label">Ders</span>
              {courseNames.length ? (
                <select className="input" value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })}>
                  <option value="">— Ders seçin —</option>
                  {courseNames.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <span className="block pt-2 text-sm text-amber-700">
                  Kurumda ders yok. <Link href="/kurum/dersler?yeni=1" className="font-medium text-brand-600 hover:underline">Dersler sayfasında ekleyin</Link>.
                </span>
              )}
            </label>
            <label>
              <span className="label">Düzey</span>
              <select className="input" value={meta.grade} onChange={(e) => setMeta({ ...meta, grade: e.target.value })}>
                {grades.map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-2 text-[12.5px] text-lead">
            Müfredat ders açmaz: ders <Link href="/kurum/dersler" className="text-brand-600 hover:underline">Dersler</Link>&apos;de, düzey{" "}
            <Link href="/kurum/siniflar" className="text-brand-600 hover:underline">Sınıflar</Link>&apos;da tanımlanır. Bu düzeydeki ve bu dersi alan bütün sınıflar müfredatı kullanır.
          </p>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-rule">
            <tr className="text-left text-[12.5px] text-lead">
              <th className="w-8 px-2 py-1.5" />
              <th className="px-2 py-1.5 font-semibold">Ünite</th>
              <th className="px-2 py-1.5 font-semibold">Konu</th>
              <th className="w-28 px-2 py-1.5 font-semibold">Kazanım kodu</th>
              <th className="px-2 py-1.5 font-semibold">Kazanım</th>
              <th className="w-16 px-2 py-1.5 font-semibold" title="Konunun kaç ders haftası süreceği (tarih değil). Tarihleri yıllık plan verir.">Süre (hf)</th>
              <th className="w-20 px-2 py-1.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-rule/70">
            {rows.map((r, i) => (
              <tr key={i} className="align-top">
                <td className="num px-2 py-1.5 pt-3 text-right text-xs text-lead">{i + 1}</td>
                <td className="px-1 py-1">
                  <input className="input px-2 py-1" value={r.unit} onChange={(e) => set(i, { unit: e.target.value })} aria-label={`${i + 1}. satır ünite`} />
                </td>
                <td className="px-1 py-1">
                  <input className="input px-2 py-1 font-medium" value={r.topic} onChange={(e) => set(i, { topic: e.target.value })} aria-label={`${i + 1}. satır konu`} />
                </td>
                <td className="px-1 py-1">
                  <input className="input px-2 py-1 font-mono text-xs" value={r.code} onChange={(e) => set(i, { code: e.target.value })} aria-label={`${i + 1}. satır kazanım kodu`} />
                </td>
                <td className="px-1 py-1">
                  <textarea rows={1} className="input min-h-8 px-2 py-1 text-xs" value={r.outcome} onChange={(e) => set(i, { outcome: e.target.value })} aria-label={`${i + 1}. satır kazanım`} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" min={1} max={20} className="input px-2 py-1 text-center" value={r.weeks} onChange={(e) => set(i, { weeks: Number(e.target.value) || 1 })} aria-label={`${i + 1}. satır süre (hafta)`} />
                </td>
                <td className="px-1 py-1.5 whitespace-nowrap text-xs text-lead">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1 disabled:opacity-30" aria-label="Yukarı">↑</button>
                  <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="px-1 disabled:opacity-30" aria-label="Aşağı">↓</button>
                  <button onClick={() => setRows((l) => l.filter((_, j) => j !== i))} className="px-1 hover:text-red-700" aria-label="Satırı sil">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-secondary" onClick={() => setRows([...rows, { unit: rows[rows.length - 1]?.unit ?? "", topic: "", code: "", outcome: "", weeks: 1 }])}>
          + Konu ekle
        </button>
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
        {!isNew && <button className="btn-danger ml-auto" onClick={removeSet}>Bu müfredatı sil</button>}
      </div>
      <p className="mt-2 text-xs text-lead">
        Konu adları yıllık plan, soru havuzu ve deneme konularında aynen kullanılır; takip ekranı bu adlarla eşleştirir. Sıra, yıllık planın sırasıdır.
      </p>
    </div>
  );
}
