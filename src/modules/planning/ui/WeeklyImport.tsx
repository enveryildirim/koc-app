"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { buildSubjectPlans, izinRanges, parseDelimitedTable, parseWeeklyTable, type WeeklyTable } from "../weekly";

type Cls = { id: string; name: string; level: string; courses: string[] };
type Result = { created: string[]; replaced: string[]; skipped: string[]; holidaysAdded: number; warnings: string[] };

const SAMPLE = [
  ["Hafta", "Kur'ân-ı Kerîm", "Tecvid", "İlmihal", "Kitâbet"],
  ["31 Ağustos 2026", "Yaz talebe izni", "", "", ""],
  ["7 Eylül 2026", "İntibak haftası, Elif cüzü", "Esmâü'l-hurûf ve mahreç tekrarı", "Suâller tekrarı", "Ünite 1: Osmanlı Türkçesi ve yazı çeşitleri"],
  ["14 Eylül 2026", "Âl-i İmrân s. 51-52", "Tecvidin tarifi, mevzuu, gayesi", "Dinden İslam'a kadar tekrar", "Harf birleşim kaideleri"],
  ["21 Eylül 2026", "Âl-i İmrân s. 53-54", "Kıraat imamı ve râvîsi", "İslam'dan namazın rükünlerine kadar", "Kitâbet deneme imtihanı 1"],
];

const dm = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

/**
 * Haftalık plan içe aktarma: satırlar haftalar, sütunlar dersler. Her ders sütunu seçilen sınıflar için bir yıllık
 * plana dönüşür; izin haftaları takvime tatil olarak eklenir. Önizleme kaydetmeden önce sonucu gösterir.
 */
export default function WeeklyImport({ classes }: { classes: Cls[] }) {
  const [table, setTable] = useState<WeeklyTable | null>(null);
  const [file, setFile] = useState("");
  const [text, setText] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [addHolidays, setAddHolidays] = useState(true);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const plans = useMemo(() => (table ? buildSubjectPlans(table) : []), [table]);
  const izin = useMemo(() => (table ? izinRanges(table) : []), [table]);
  const subjectName = (s: string) => (names[s] ?? s).trim();
  const chosen = classes.filter((c) => selected.includes(c.id));

  function load(raw: unknown[][], name: string) {
    const t = parseWeeklyTable(raw);
    setTable(t);
    setFile(name);
    setNames({});
    setResult(null);
    setError("");
  }

  async function onFile(f?: File) {
    if (!f) return;
    try {
      if (/\.xlsx$/i.test(f.name)) {
        const { default: readXlsxFile } = await import("read-excel-file");
        load(await readXlsxFile(f), f.name);
      } else if (/\.xls$/i.test(f.name)) {
        setError("Eski .xls biçimi desteklenmiyor. Excel'de .xlsx olarak kaydedin.");
      } else {
        load(parseDelimitedTable(await f.text()), f.name);
      }
    } catch {
      setError("Dosya okunamadı.");
    }
  }

  function downloadTemplate() {
    const csv = SAMPLE.map((r) => r.map((c) => (c.includes(";") ? `"${c}"` : c)).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "haftalik-plan-ornek.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function save() {
    setBusy(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/kurum/plan/haftalik", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classroomIds: selected,
        plans: plans.map((p) => ({ subject: subjectName(p.subject), startDate: p.startDate, source: p.source })),
        izin: izin.map((z) => ({ start: z.start, end: z.end, label: z.label })),
        teachWeeks: table!.weeks.filter((w) => !w.izin).map((w) => w.monday),
        addHolidays,
        replace,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(j.error ?? "Kaydedilemedi.");
    setResult(j);
  }

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="font-semibold">1. Tablo</h2>
        <p className="mt-1 text-sm text-lead">
          İlk sütun haftanın tarihi (ör. “7 Eylül 2026” ya da 07.09.2026), diğer sütunlar ders adları; her hücre o hafta işlenecek konu.
          Boş hücre önceki konunun bir hafta daha sürdüğü anlamına gelir. Bütün dersleri boş ya da “izin / tatil” yazan satır izin haftasıdır.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="btn-primary cursor-pointer">
            Excel / CSV seç
            <input type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <button className="btn-secondary" onClick={downloadTemplate}>Örnek şablonu indir</button>
          <button className="btn-secondary" onClick={() => load(SAMPLE, "örnek")}>Örnekle dene</button>
          {file && <span className="text-sm text-lead">{file}</span>}
        </div>
        <textarea
          className="input mt-3 font-mono text-xs"
          rows={3}
          placeholder="…veya Excel'den kopyalayıp buraya yapıştırın (başlık satırıyla)"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) load(parseDelimitedTable(e.target.value), "yapıştırılan tablo");
          }}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {table && table.errors.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm text-amber-800">
            {table.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
            {table.errors.length > 5 && <li>ve {table.errors.length - 5} uyarı daha</li>}
          </ul>
        )}
      </section>

      {table && plans.length > 0 && (
        <>
          <section className="card">
            <div className="border-b border-rule/70 px-4 py-3">
              <h2 className="font-semibold">2. Önizleme</h2>
              <p className="text-[13px] text-lead">
                {table.weeks.length} hafta ({table.weeks.length - izin.length} ders haftası, {izin.length} izin) · {plans.length} ders.
                Ders adını sınıftaki ders kaydıyla aynı yazın; yoklama ve “işlendi” işareti bu adla eşleşir.
              </p>
            </div>
            <ul className="divide-y divide-rule/70">
              {plans.map((p) => {
                const name = subjectName(p.subject);
                const missingIn = chosen.filter((c) => !c.courses.includes(name)).map((c) => c.name);
                return (
                  <li key={p.subject} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <input className="input w-56 py-1 font-medium" value={names[p.subject] ?? p.subject} onChange={(e) => setNames({ ...names, [p.subject]: e.target.value })} aria-label="Ders adı" />
                      <span className="text-[13px] text-lead">{p.topics} konu · {p.weeks} ders haftası · başlangıç {dm(p.startDate)}</span>
                      {missingIn.length > 0 && <span className="text-[12.5px] text-amber-700">Bu adla ders yok: {missingIn.join(", ")}</span>}
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[13px] text-brand-600">Konular</summary>
                      <pre className="mt-1 max-h-48 overflow-auto rounded bg-paper p-2 text-[12px] whitespace-pre-wrap">{p.source}</pre>
                    </details>
                  </li>
                );
              })}
            </ul>
            {izin.length > 0 && (
              <p className="border-t border-rule/70 px-4 py-2 text-[13px] text-lead">
                İzin haftaları: {izin.map((z) => `${dm(z.start)}${z.label && !/^\d/.test(z.label) ? ` (${z.label})` : ""}`).join(", ")}
              </p>
            )}
          </section>

          <section className="card p-4">
            <h2 className="font-semibold">3. Sınıflar</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {classes.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected(on ? selected.filter((x) => x !== c.id) : [...selected, c.id])}
                    className={`rounded-full px-3 py-1 text-sm font-medium ${on ? "bg-graphite text-white" : "bg-surface ring-1 ring-rule"}`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={addHolidays} onChange={(e) => setAddHolidays(e.target.checked)} />
              İzin haftalarını seçilen sınıfların takvimine tatil olarak ekle (önerilir; yoksa tarihler kayar)
            </label>
            <label className="mt-1 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              Aynı ders için plan varsa yeniden yaz (aynı adlı konuların “işlendi” bilgisi korunur)
            </label>
            <div className="mt-3 flex items-center gap-3">
              <button className="btn-primary" disabled={busy || !selected.length} onClick={save}>
                {busy ? "Kaydediliyor…" : `${selected.length * plans.length} planı kaydet`}
              </button>
              {!selected.length && <span className="text-sm text-lead">Önce sınıf seçin.</span>}
            </div>
          </section>
        </>
      )}

      {result && (
        <section className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <p>
            {result.created.length} plan oluşturuldu{result.replaced.length ? `, ${result.replaced.length} plan yeniden yazıldı` : ""}
            {result.holidaysAdded ? `, takvime ${result.holidaysAdded} izin haftası eklendi` : ""}.{" "}
            <Link href="/kurum/takvim/plan" className="font-semibold underline">Yıllık planlar</Link>
          </p>
          {result.skipped.length > 0 && <p className="mt-1 text-amber-800">Planı zaten olduğu için atlananlar: {result.skipped.join(", ")}.</p>}
          {result.warnings.map((w, i) => <p key={i} className="mt-1 text-amber-800">{w}</p>)}
        </section>
      )}
    </div>
  );
}
