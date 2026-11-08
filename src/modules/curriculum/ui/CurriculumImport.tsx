"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRICULUM_COLUMNS, gradeLabel, parseCurriculumTable, type CurriculumRow } from "../index";

function parseDelimited(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const first = lines[0] ?? "";
  const delim = first.includes("\t") ? "\t" : first.split(";").length > first.split(",").length ? ";" : ",";
  return lines.map((l) => l.split(delim).map((c) => c.replace(/^"|"$/g, "").trim()));
}

/**
 * Excel / CSV'den müfredat içe aktarma: dosyayı tarayıcıda okur, özet gösterir, seçilen kipte kaydeder.
 * Kurumda karşılığı olmayan ders adı ya da düzey uyarılır (aktarılır ama sınıflarla eşleşmez).
 */
export default function CurriculumImport({
  hasData,
  courseNames = [],
  grades = [],
  existing = [],
}: {
  hasData: boolean;
  courseNames?: string[];
  grades?: string[];
  /** Kurumda var olan setler: { subject, grade, topics } */
  existing?: { subject: string; grade: string; topics: number }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!hasData);
  const [file, setFile] = useState("");
  const [parsed, setParsed] = useState<{ rows: CurriculumRow[]; errors: string[]; missing: string[] } | null>(null);
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setMsg(null);
    setFile(f.name);
    try {
      let table: unknown[][];
      if (/\.xlsx$/i.test(f.name)) {
        const { default: readXlsxFile } = await import("read-excel-file");
        table = await readXlsxFile(f);
      } else if (/\.xls$/i.test(f.name)) {
        return setMsg({ ok: false, text: "Eski .xls biçimi desteklenmiyor. Dosyayı Excel'de .xlsx olarak kaydedip tekrar deneyin." });
      } else {
        table = parseDelimited(await f.text());
      }
      setParsed(parseCurriculumTable(table));
    } catch {
      setMsg({ ok: false, text: "Dosya okunamadı." });
    }
  }

  async function post(url: string, body?: unknown) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: json.error ?? "Kaydedilemedi." });
      return null;
    }
    router.refresh();
    return json;
  }

  async function importRows() {
    if (!parsed?.rows.length) return;
    const r = await post("/api/kurum/mufredat/ice-aktar", { rows: parsed.rows, mode });
    if (r) {
      setMsg({ ok: true, text: `${r.rows} konu, ${r.sets} sete aktarıldı.` });
      setParsed(null);
      setFile("");
    }
  }

  async function loadSample() {
    const r = await post("/api/kurum/mufredat/ornek");
    if (r) setMsg({ ok: true, text: r.rows ? `Örnek müfredat yüklendi: ${r.sets} set, ${r.rows} konu.` : "Örnek setlerin hepsi zaten var." });
  }

  // Dosyadaki setlerin özeti ve bunlardan kurumda zaten var olanlar
  const sets = new Map<string, { subject: string; grade: string; n: number }>();
  for (const r of parsed?.rows ?? []) {
    const k = `${r.subject}\u0000${r.grade}`;
    sets.set(k, { subject: r.subject, grade: r.grade, n: (sets.get(k)?.n ?? 0) + 1 });
  }
  const setName = (s: { subject: string; grade: string }) => `${s.subject} · ${gradeLabel(s.grade)}`;
  const clashing = [...sets.values()].flatMap((s) => {
    const e = existing.find((x) => x.subject === s.subject && x.grade === s.grade);
    return e ? [{ ...s, have: e.topics }] : [];
  });
  // Kurumda karşılığı olmayanlar (yazım farkı olabilir)
  const lower = (x: string) => x.toLocaleLowerCase("tr-TR");
  const unknownSubjects = [...new Set((parsed?.rows ?? []).map((r) => r.subject))].filter((x) => !courseNames.some((c) => lower(c) === lower(x)));
  const unknownGrades = [...new Set((parsed?.rows ?? []).map((r) => r.grade))].filter((g) => !grades.includes(g));

  if (!open)
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        Excel&apos;den yükle
      </button>
    );

  return (
    <div className="card mb-4 w-full px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Excel&apos;den müfredat yükle</h2>
        {hasData && <button className="text-[13px] text-lead hover:text-graphite" onClick={() => setOpen(false)}>Kapat</button>}
      </div>
      <p className="mt-1 text-[13px] text-lead">
        Sütunlar: {CURRICULUM_COLUMNS.map((c) => (c.required ? <b key={c.key}>{c.label}</b> : c.label)).reduce<React.ReactNode[]>((a, x, i) => (i ? [...a, ", ", x] : [x]), [])}. Kalın
        olanlar zorunlu; ders ve sınıf boşsa üstteki satırınki kullanılır. Bir dosyada birden çok ders ve sınıf olabilir.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="btn-secondary cursor-pointer">
          Dosya seç (.xlsx, .csv)
          <input type="file" accept=".xlsx,.csv,.txt" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {file && <span className="text-[13px] text-lead">{file}</span>}
        <span className="mx-1 h-4 w-px bg-rule" />
        <button className="btn-secondary" disabled={busy} onClick={loadSample} title="8. sınıf, 12. sınıf ve TYT için örnek setler">
          Örnek müfredatı yükle
        </button>
      </div>

      {parsed && (
        <div className="mt-3 rounded-md bg-paper p-3 text-sm">
          {parsed.missing.length > 0 ? (
            <p className="text-red-700">Dosyada şu sütunlar bulunamadı: {parsed.missing.join(", ")}.</p>
          ) : (
            <>
              <p>
                <b>{parsed.rows.length}</b> konu okundu: {[...sets.values()].map((s) => `${setName(s)} (${s.n})`).join(", ") || "—"}
              </p>
              {(unknownSubjects.length > 0 || unknownGrades.length > 0) && (
                <ul className="mt-1 text-xs text-amber-800">
                  {unknownSubjects.length > 0 && <li>Kurumda bu adla ders yok: {unknownSubjects.join(", ")}. Aktarılır ama hiçbir sınıfın dersiyle eşleşmez; adı Dersler&apos;deki adla aynı yapın.</li>}
                  {unknownGrades.length > 0 && <li>Kurumda bu düzeyde sınıf yok: {unknownGrades.map(gradeLabel).join(", ")}. Sınıflar&apos;da sınıfa düzey yazın ya da dosyadaki düzeyi düzeltin.</li>}
                </ul>
              )}
              {parsed.errors.length > 0 && (
                <ul className="mt-1 text-xs text-amber-800">
                  {parsed.errors.slice(0, 5).map((e) => <li key={e}>{e}</li>)}
                  {parsed.errors.length > 5 && <li>… ve {parsed.errors.length - 5} satır daha (aktarılmayacak)</li>}
                </ul>
              )}
              {clashing.length > 0 && (
                <fieldset className="mt-3 rounded-md bg-surface p-3 ring-1 ring-rule">
                  <legend className="px-1 text-[13px] font-semibold">
                    Bu {clashing.length > 1 ? "müfredatlar" : "müfredat"} zaten var: {clashing.map((c) => `${setName(c)} (${c.have} konu)`).join(", ")}. Ne yapılsın?
                  </legend>
                  <label className="mt-1 flex items-start gap-2">
                    <input type="radio" className="mt-1" checked={mode === "replace"} onChange={() => setMode("replace")} />
                    <span>
                      <b>Dosyadakiyle değiştir</b> <span className="text-xs text-lead">(önerilen)</span>
                      <span className="block text-xs text-lead">
                        Konu listesi dosyadaki listeyle değiştirilir. Adı aynı kalan konular korunur; yıllık plandaki &quot;işlendi&quot; işaretleri kaybolmaz.
                        Dosyada olmayan konular silinir.
                      </span>
                    </span>
                  </label>
                  <label className="mt-2 flex items-start gap-2">
                    <input type="radio" className="mt-1" checked={mode === "append"} onChange={() => setMode("append")} />
                    <span>
                      <b>Sonuna ekle</b>
                      <span className="block text-xs text-lead">Var olan konular kalır, dosyadakiler listenin sonuna eklenir. Aynı konu iki kez yazılabilir.</span>
                    </span>
                  </label>
                </fieldset>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-xs text-lead">
                  {clashing.length < sets.size && `${clashing.length ? "Diğerleri" : "Hepsi"} yeni müfredat olarak eklenir. `}Dosyada olmayan müfredatlara dokunulmaz.
                </span>
                <button className="btn-primary ml-auto" disabled={busy || !parsed.rows.length} onClick={importRows}>
                  {busy ? "Aktarılıyor…" : "İçe aktar"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
