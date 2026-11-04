"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = Record<Field, string>;
type Field = "studentNo" | "firstName" | "lastName" | "className" | "phone" | "parentName" | "parentPhone";

const FIELDS: { key: Field; label: string; aliases: string[] }[] = [
  { key: "studentNo", label: "Numara", aliases: ["numara", "no", "ogrenci no", "ogrencino", "okul no", "numarasi"] },
  { key: "firstName", label: "Ad", aliases: ["ad", "adi", "isim"] },
  { key: "lastName", label: "Soyad", aliases: ["soyad", "soyadi"] },
  { key: "className", label: "Sınıf", aliases: ["sinif", "sube", "sinif/sube", "sinif sube"] },
  { key: "phone", label: "Telefon", aliases: ["telefon", "tel", "ogrenci telefon", "cep"] },
  { key: "parentName", label: "Veli Adı", aliases: ["veli", "veli adi", "veli ad soyad"] },
  { key: "parentPhone", label: "Veli Telefonu", aliases: ["veli telefon", "veli telefonu", "veli tel"] },
];

const normH = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z/ ]/g, "")
    .trim();

function mapRows(table: string[][]): { rows: Row[]; missing: string[] } {
  if (table.length < 2) return { rows: [], missing: ["başlık satırı + en az bir öğrenci"] };
  const header = table[0].map((h) => normH(String(h ?? "")));
  const idx = {} as Record<Field, number>;
  for (const f of FIELDS) idx[f.key] = header.findIndex((h) => f.aliases.includes(h));
  // "Ad Soyad" tek sütunsa böl
  const fullIdx = header.findIndex((h) => h === "ad soyad" || h === "adi soyadi");
  const missing = FIELDS.filter((f) => ["studentNo", "firstName", "lastName"].includes(f.key) && idx[f.key] < 0 && !(fullIdx >= 0 && f.key !== "studentNo")).map((f) => f.label);
  const rows = table
    .slice(1)
    .filter((r) => r.some((c) => String(c ?? "").trim()))
    .map((r) => {
      const get = (k: Field) => (idx[k] >= 0 ? String(r[idx[k]] ?? "").trim() : "");
      let firstName = get("firstName");
      let lastName = get("lastName");
      if ((!firstName || !lastName) && fullIdx >= 0) {
        const parts = String(r[fullIdx] ?? "").trim().split(/\s+/);
        lastName = parts.pop() ?? "";
        firstName = parts.join(" ");
      }
      return {
        studentNo: get("studentNo").replace(/\.0$/, ""),
        firstName,
        lastName,
        className: get("className"),
        phone: get("phone"),
        parentName: get("parentName"),
        parentPhone: get("parentPhone"),
      };
    });
  return { rows, missing };
}

function parseDelimited(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const first = lines[0] ?? "";
  const delim = first.includes("\t") ? "\t" : first.split(";").length > first.split(",").length ? ";" : ",";
  return lines.map((l) => l.split(delim).map((c) => c.replace(/^"|"$/g, "").trim()));
}

function validate(rows: Row[]) {
  const seen = new Map<string, number>();
  return rows.map((r, i) => {
    const errs: string[] = [];
    if (!/^\d{1,6}$/.test(r.studentNo)) errs.push("numara 1–6 hane olmalı");
    if (!r.firstName || !r.lastName) errs.push("ad/soyad eksik");
    if (seen.has(r.studentNo)) errs.push(`numara ${seen.get(r.studentNo)! + 2}. satırla aynı`);
    seen.set(r.studentNo, i);
    return errs;
  });
}

export default function ImportStudents() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [info, setInfo] = useState("");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);

  function load(table: string[][], from: string) {
    const { rows, missing } = mapRows(table);
    setResult(null);
    if (missing.length) {
      setRows([]);
      setInfo(`Başlık satırında şu sütunlar bulunamadı: ${missing.join(", ")}. Şablondaki başlıkları kullanın.`);
      return;
    }
    setRows(rows);
    setInfo(`${from}: ${rows.length} satır okundu.`);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      if (/\.xlsx$/i.test(f.name)) {
        const { default: readXlsxFile } = await import("read-excel-file");
        const table = (await readXlsxFile(f)).map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : String(c ?? ""))));
        load(table, f.name);
      } else if (/\.xls$/i.test(f.name)) {
        setInfo("Eski .xls biçimi desteklenmiyor. Dosyayı Excel'de .xlsx veya CSV olarak kaydedip tekrar deneyin.");
      } else {
        load(parseDelimited(await f.text()), f.name);
      }
    } catch {
      setInfo("Dosya okunamadı. Şablonu kullanarak tekrar deneyin.");
    }
  }

  function template() {
    const csv = [
      "Numara;Ad;Soyad;Sınıf;Telefon;Veli Adı;Veli Telefonu",
      "2001;Deniz;Aydın;8-A;0532 111 22 33;Selma Aydın;0533 444 55 66",
      "2002;Ece;Kara;8-B;;Hakan Kara;0535 777 88 99",
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "ogrenci_yukleme_sablonu.csv";
    a.click();
  }

  function sample() {
    const names = ["Aras", "Beren", "Cenk", "Damla", "Egemen", "Feyza", "Gökay", "Hira", "Ilgaz", "Lara"];
    const surnames = ["Uysal", "Tekin", "Bulut", "Sarı", "Acar", "Ekinci", "Bozkurt", "Turan"];
    const base = 3000 + Math.floor(Math.random() * 900);
    const table = [["Numara", "Ad", "Soyad", "Sınıf", "Telefon", "Veli Adı", "Veli Telefonu"]];
    for (let i = 0; i < 10; i++) {
      const ln = surnames[i % surnames.length];
      table.push([String(base + i), names[i], ln, i < 5 ? "9-A" : "9-B", "", `Veli ${ln}`, `0530 000 00 ${String(10 + i)}`]);
    }
    load(table, "Örnek veri");
  }

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/kurum/ogrenciler/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setInfo(json.error ?? "Yüklenemedi.");
    setResult(json);
    setRows([]);
    router.refresh();
  }

  const errs = validate(rows);
  const bad = errs.filter((e) => e.length).length;

  return (
    <div className="space-y-4">
      <div className="card grid gap-6 p-5 md:grid-cols-2">
        <div>
          <h2 className="font-semibold">1. Dosya seçin</h2>
          <p className="mt-1 text-sm text-lead">
            Excel (.xlsx) veya CSV. İlk satır başlık olmalı: <b>Numara, Ad, Soyad, Sınıf</b> (zorunlu olmayanlar: Telefon, Veli Adı, Veli Telefonu).
            Aynı numaralı öğrenci varsa bilgileri güncellenir, olmayan sınıflar otomatik oluşturulur.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="btn-primary cursor-pointer">
              Excel / CSV seç
              <input type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <button className="btn-secondary" onClick={template}>⬇ Şablonu indir</button>
            <button className="btn-secondary" onClick={sample}>🧪 Örnek veriyle dene</button>
          </div>
        </div>
        <div>
          <h2 className="font-semibold">…veya Excel’den kopyalayıp yapıştırın</h2>
          <textarea
            className="input mt-2 font-mono text-xs"
            rows={5}
            placeholder={"Numara\tAd\tSoyad\tSınıf\n2001\tDeniz\tAydın\t8-A"}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button className="btn-secondary mt-2" disabled={!paste.trim()} onClick={() => load(parseDelimited(paste), "Yapıştırılan veri")}>
            Önizle
          </button>
        </div>
      </div>

      {info && <p className="rounded-lg bg-mist px-4 py-2 text-sm text-graphite/90">{info}</p>}
      {result && (
        <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {result.created} öğrenci eklendi, {result.updated} öğrenci güncellendi.
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-red-700">
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule/70 p-4">
            <h2 className="font-semibold">2. Önizleme ({rows.length} öğrenci{bad ? `, ${bad} hatalı satır atlanacak` : ""})</h2>
            <button className="btn-primary" disabled={busy || bad === rows.length} onClick={submit}>
              {busy ? "Yükleniyor…" : `${rows.length - bad} öğrenciyi yükle`}
            </button>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-paper text-left text-xs text-lead">
                <tr>
                  <th className="px-3 py-2">#</th>
                  {FIELDS.map((f) => (
                    <th key={f.key} className="px-3 py-2">{f.label}</th>
                  ))}
                  <th className="px-3 py-2">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/70">
                {rows.map((r, i) => (
                  <tr key={i} className={errs[i].length ? "bg-red-50" : ""}>
                    <td className="px-3 py-1.5 text-lead/70">{i + 2}</td>
                    {FIELDS.map((f) => (
                      <td key={f.key} className="px-3 py-1.5">{r[f.key]}</td>
                    ))}
                    <td className="px-3 py-1.5 text-xs">
                      {errs[i].length ? <span className="text-red-700">{errs[i].join(", ")}</span> : <span className="text-emerald-700">✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
