"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LETTERS } from "../domain";

/** Optik okuyucu dosyasındaki alanların konumu (1'den başlayan sütun numaraları). */
type Def = { nameStart: number; nameLen: number; noStart: number; noLen: number; bookletStart: number; ansStart: number };

const STORAGE = "sinavkur.optikTanim";
const norm = (s: string) => s.replace(/\D/g, "").replace(/^0+/, "") || "0";

function defaultDef(): Def {
  return { nameStart: 1, nameLen: 25, noStart: 26, noLen: 6, bookletStart: 32, ansStart: 33 };
}

type Props = {
  examId: string;
  total: number;
  bookletB: boolean;
  choices: number;
  sampleNos: string[];
  students: Record<string, string>;
  keyA: string;
  keyB: string;
};

export default function TxtImport({ examId, total, bookletB, choices, sampleNos, students, keyA, keyB }: Props) {
  const [def, setDef] = useState<Def>(defaultDef);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ saved: number; skipped: string[] } | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE);
      if (s) setDef({ ...defaultDef(), ...JSON.parse(s) });
    } catch {}
  }, []);
  const updateDef = (k: keyof Def, v: number) => {
    const d = { ...def, [k]: Math.max(1, v || 1) };
    setDef(d);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(d));
    } catch {}
  };

  const lines = useMemo(() => text.replace(/\r/g, "").split("\n").filter((l) => l.trim()), [text]);
  const parsed = useMemo(
    () =>
      lines.map((l) => {
        const cut = (start: number, len: number) => l.slice(start - 1, start - 1 + len);
        const studentNo = cut(def.noStart, def.noLen).trim();
        const raw = cut(def.ansStart, total).padEnd(total, " ");
        const answers = raw
          .toUpperCase()
          .split("")
          .map((ch) => (LETTERS.slice(0, choices).includes(ch) ? ch : ch === "*" ? "*" : " "))
          .join("");
        const bk = bookletB ? cut(def.bookletStart, 1).toUpperCase() : "A";
        return {
          name: cut(def.nameStart, def.nameLen).trim(),
          studentNo,
          booklet: bk === "B" ? "B" : "A",
          bookletOk: !bookletB || bk === "A" || bk === "B",
          answers,
          match: students[norm(studentNo)],
        };
      }),
    [lines, def, total, choices, bookletB, students],
  );

  async function onFile(f?: File) {
    if (!f) return;
    // Okuyucular çoğunlukla Windows-1254 (Türkçe) üretir; UTF-8 geçerli değilse ona düş.
    const buf = await f.arrayBuffer();
    let t = new TextDecoder("utf-8").decode(buf);
    if (t.includes("�")) t = new TextDecoder("windows-1254").decode(buf);
    setText(t);
    setResult(null);
  }

  function sample() {
    const pad = (s: string, n: number) => s.slice(0, n).padEnd(n, " ");
    const out = sampleNos.slice(0, 25).map((no) => {
      const bk = bookletB && Math.random() < 0.5 ? "B" : "A";
      const key = bk === "B" ? keyB : keyA;
      const skill = 0.35 + Math.random() * 0.6;
      let ans = "";
      for (let i = 0; i < total; i++) {
        const r = Math.random();
        if (r < 0.08) ans += " ";
        else if (r < 0.09) ans += "*";
        else if (Math.random() < skill && key[i]?.trim()) ans += key[i];
        else ans += LETTERS[Math.floor(Math.random() * choices)];
      }
      const name = (students[norm(no)] ?? "").split(" (")[0].toLocaleUpperCase("tr-TR");
      const line = Array(def.ansStart + total).fill(" ");
      const put = (start: number, s: string) => s.split("").forEach((ch, i) => (line[start - 1 + i] = ch));
      put(def.nameStart, pad(name, def.nameLen));
      put(def.noStart, no.padStart(def.noLen, "0"));
      if (bookletB) put(def.bookletStart, bk);
      put(def.ansStart, ans);
      return line.join("");
    });
    setText(out.join("\n"));
    setResult(null);
  }

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/kurum/denemeler/${examId}/sonuclar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "TXT", rows: parsed.map((p) => ({ studentNo: p.studentNo, booklet: p.booklet, answers: p.answers })) }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return alert(json.error ?? "Kaydedilemedi.");
    setResult(json);
    setText("");
  }

  const matched = parsed.filter((p) => p.match).length;
  const ruler = useMemo(() => {
    const n = Math.min(Math.max(def.ansStart + total, 40), 260);
    return Array.from({ length: n }, (_, i) => ((i + 1) % 10 === 0 ? String(((i + 1) / 10) % 10) : (i + 1) % 5 === 0 ? "+" : "·")).join("");
  }, [def.ansStart, total]);
  const highlight = (l: string) => {
    const zones: [number, number, string][] = [
      [def.nameStart, def.nameLen, "bg-sky-100"],
      [def.noStart, def.noLen, "bg-amber-100"],
      ...(bookletB ? [[def.bookletStart, 1, "bg-violet-200"] as [number, number, string]] : []),
      [def.ansStart, total, "bg-emerald-50"],
    ];
    return l.split("").map((ch, i) => {
      const z = zones.find(([s, len]) => i + 1 >= s && i + 1 < s + len);
      return (
        <span key={i} className={z?.[2]}>
          {ch === " " ? " " : ch}
        </span>
      );
    });
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="font-semibold">1. Optik tanımı</h2>
        <p className="mt-1 text-sm text-slate-500">
          Optik okuyucunuzun ürettiği dosyada her alanın hangi sütundan başladığını girin (ilk karakter = 1). Tanım tarayıcınızda saklanır.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Num label="Ad soyad başlangıç" v={def.nameStart} on={(n) => updateDef("nameStart", n)} cls="bg-sky-100" />
          <Num label="Ad soyad uzunluk" v={def.nameLen} on={(n) => updateDef("nameLen", n)} cls="bg-sky-100" />
          <Num label="Öğrenci no başlangıç" v={def.noStart} on={(n) => updateDef("noStart", n)} cls="bg-amber-100" />
          <Num label="Öğrenci no uzunluk" v={def.noLen} on={(n) => updateDef("noLen", n)} cls="bg-amber-100" />
          {bookletB && <Num label="Kitapçık sütunu" v={def.bookletStart} on={(n) => updateDef("bookletStart", n)} cls="bg-violet-200" />}
          <Num label={`Cevaplar başlangıç (${total} sütun)`} v={def.ansStart} on={(n) => updateDef("ansStart", n)} cls="bg-emerald-50" />
        </div>
        <button className="mt-3 text-sm font-medium text-brand-600" onClick={() => { setDef(defaultDef()); try { localStorage.removeItem(STORAGE); } catch {} }}>
          Varsayılan tanıma dön
        </button>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">2. Dosyayı yükleyin</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="btn-primary cursor-pointer">
            📄 TXT / DAT dosyası seç
            <input type="file" accept=".txt,.dat,.csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <button className="btn-secondary" onClick={sample}>🧪 Örnek okuyucu dosyası üret</button>
        </div>
        <textarea
          className="input mt-3 font-mono text-xs"
          rows={4}
          placeholder="…veya dosya içeriğini buraya yapıştırın"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
        />
      </div>

      {result && (
        <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {result.saved} sonuç kaydedildi.
          {result.skipped.length > 0 && <span className="text-amber-700"> Eşleşmeyen numaralar atlandı: {result.skipped.join(", ")}.</span>}{" "}
          <Link href={`/kurum/denemeler/${examId}?tab=sonuclar`} className="font-semibold underline">Sıralı listeyi gör →</Link>
        </div>
      )}

      {parsed.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
            <h2 className="font-semibold">
              3. Önizleme · {parsed.length} satır, {matched} öğrenci eşleşti
              {parsed.length - matched > 0 && <span className="text-amber-700"> ({parsed.length - matched} eşleşmeyen atlanacak)</span>}
            </h2>
            <button className="btn-primary" disabled={busy || matched === 0} onClick={save}>
              {busy ? "Kaydediliyor…" : `${matched} sonucu kaydet`}
            </button>
          </div>
          <div className="overflow-x-auto border-b border-slate-100 bg-slate-50 p-3 font-mono text-[11px] leading-5">
            <div className="whitespace-pre text-slate-400">{ruler}</div>
            {lines.slice(0, 3).map((l, i) => (
              <div key={i} className="whitespace-pre">{highlight(l)}</div>
            ))}
            <div className="mt-1 font-sans text-xs text-slate-500">İlk 3 satır · renkler optik tanımındaki alanları gösterir</div>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white text-left uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Dosyadaki ad</th>
                  <th className="px-3 py-2">No</th>
                  <th className="px-3 py-2">Eşleşen öğrenci</th>
                  {bookletB && <th className="px-3 py-2">Kt.</th>}
                  <th className="px-3 py-2">Cevaplar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsed.map((p, i) => (
                  <tr key={i} className={p.match ? "" : "bg-amber-50"}>
                    <td className="px-3 py-1.5">{p.name || "—"}</td>
                    <td className="px-3 py-1.5 font-mono">{p.studentNo || "—"}</td>
                    <td className="px-3 py-1.5">{p.match ?? <span className="text-amber-700">Eşleşmedi</span>}</td>
                    {bookletB && <td className={`px-3 py-1.5 font-bold ${p.bookletOk ? "" : "text-red-600"}`}>{p.booklet}</td>}
                    <td className="max-w-md truncate px-3 py-1.5 font-mono text-slate-500">{p.answers.replace(/ /g, "·")}</td>
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

function Num({ label, v, on, cls }: { label: string; v: number; on: (n: number) => void; cls: string }) {
  return (
    <div>
      <label className="label text-xs">
        <span className={`mr-1 inline-block h-2.5 w-2.5 rounded-sm ${cls}`} />
        {label}
      </label>
      <input type="number" min={1} className="input" value={v} onChange={(e) => on(Number(e.target.value))} />
    </div>
  );
}
