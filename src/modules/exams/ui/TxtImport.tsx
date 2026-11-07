"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LETTERS } from "../domain";
import { contiguous, readLine, readerFormatError, writeLine, type ReaderFormat } from "../reader";

const norm = (s: string) => s.replace(/\D/g, "").replace(/^0+/, "") || "0";

type Props = {
  examId: string;
  /** Bölümler (ad, soru sayısı) — biçimde her bölümün başlangıç sütunu ayrı */
  sections: { name: string; count: number }[];
  /** Sınavda kayıtlı biçim (yoksa varsayılan) ve kayıtlı olup olmadığı */
  format: ReaderFormat;
  saved: boolean;
  /** Biçimi kopyalanabilecek diğer sınavlar (kayıtlı biçimi olanlar) */
  others: { id: string; name: string; format: ReaderFormat }[];
  /** Denemenin kitapçıkları; tek harfse kitapçık sütunu okunmaz. */
  booklets: string[];
  choices: number;
  sampleNos: string[];
  students: Record<string, string>;
  /** Kitapçık → tüm sorular boyunca anahtar */
  keys: Record<string, string>;
};

/**
 * Optik okuyucu (FMT) TXT içe aktarma. Biçim bu sınava kaydedilir; sonraki yüklemelerde yeniden tanımlamak gerekmez.
 * Her bölümün cevapları ayrı sütundan başlayabilir.
 */
export default function TxtImport({ examId, sections, format, saved, others, booklets, choices, sampleNos, students, keys }: Props) {
  const router = useRouter();
  const bookletB = booklets.length > 1;
  const total = sections.reduce((a, s) => a + s.count, 0);
  const [def, setDef] = useState<ReaderFormat>(format);
  const [dirty, setDirty] = useState(false);
  const [fmtMsg, setFmtMsg] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ saved: number; skipped: string[]; badBooklet?: string[] } | null>(null);
  const fmtError = readerFormatError(def, sections);

  const updateDef = (patch: Partial<ReaderFormat>) => {
    setDef((d) => ({ ...d, ...patch }));
    setDirty(true);
    setFmtMsg("");
  };
  const setStart = (i: number, v: number) => updateDef({ sectionStarts: def.sectionStarts.map((x, j) => (j === i ? Math.max(1, v || 1) : x)) });

  async function saveFormat(f: ReaderFormat | null) {
    setFmtMsg("");
    const res = await fetch(`/api/kurum/denemeler/${examId}/okuyucu`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: f }),
    });
    if (!res.ok) return setFmtMsg((await res.json().catch(() => ({}))).error ?? "Kaydedilemedi.");
    setDirty(false);
    setFmtMsg(f ? "Biçim bu sınava kaydedildi." : "Varsayılan biçime dönüldü.");
    router.refresh();
  }

  const lines = useMemo(() => text.replace(/\r/g, "").split("\n").filter((l) => l.trim()), [text]);
  const parsed = useMemo(
    () =>
      lines.map((l) => {
        const r = readLine(l, def, sections, choices);
        const bk = bookletB ? r.booklet : "A";
        return { name: r.name, studentNo: r.studentNo, booklet: bk, bookletOk: !bookletB || booklets.includes(bk), answers: r.answers, match: students[norm(r.studentNo)] };
      }),
    [lines, def, sections, choices, bookletB, booklets, students],
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
    const out = sampleNos.slice(0, 25).map((no) => {
      const bk = booklets[Math.floor(Math.random() * booklets.length)];
      const key = keys[bk] ?? keys.A;
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
      return writeLine({ name, studentNo: no, booklet: bookletB ? bk : "", answers: ans }, def, sections);
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
  const width = Math.max(def.nameStart + def.nameLen, def.noStart + def.noLen, def.bookletStart + 1, ...sections.map((s, i) => def.sectionStarts[i] + s.count));
  const ruler = useMemo(() => {
    const n = Math.min(Math.max(width, 40), 400);
    return Array.from({ length: n }, (_, i) => ((i + 1) % 10 === 0 ? String(((i + 1) / 10) % 10) : (i + 1) % 5 === 0 ? "+" : "·")).join("");
  }, [width]);
  const SEC_CLS = ["bg-emerald-100", "bg-teal-100", "bg-lime-100", "bg-green-100"];
  const highlight = (l: string) => {
    const zones: [number, number, string][] = [
      [def.nameStart, def.nameLen, "bg-sky-100"],
      [def.noStart, def.noLen, "bg-amber-100"],
      ...(bookletB && def.bookletStart ? [[def.bookletStart, 1, "bg-violet-200"] as [number, number, string]] : []),
      ...sections.map((s, i) => [def.sectionStarts[i], s.count, SEC_CLS[i % SEC_CLS.length]] as [number, number, string]),
    ];
    return l.split("").map((ch, i) => {
      const z = zones.find(([s, len]) => i + 1 >= s && i + 1 < s + len);
      return (
        <span key={i} className={z?.[2]}>
          {ch === " " ? " " : ch}
        </span>
      );
    });
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">1. Okuyucu biçimi (FMT)</h2>
          <span className={`text-[13px] ${saved && !dirty ? "text-emerald-700" : "text-amber-700"}`}>
            {dirty ? "Kaydedilmemiş değişiklik var" : saved ? "Bu sınava kayıtlı" : "Varsayılan biçim (kaydedilmedi)"}
          </span>
        </div>
        <p className="mt-1 text-sm text-lead">
          Okuyucunun ürettiği dosyada her alanın hangi sütundan başladığını girin (ilk karakter = 1). Biçim bu sınavda saklanır;
          her bölümün cevapları ayrı sütundan başlayabilir.
        </p>
        {others.length > 0 && (
          <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Başka sınavdan kopyala</span>
            <select
              className="input w-auto"
              defaultValue=""
              onChange={(e) => {
                const o = others.find((x) => x.id === e.target.value);
                if (o) updateDef({ ...o.format, sectionStarts: sections.map((s, i) => o.format.sectionStarts[i] ?? contiguous(o.format.sectionStarts[0] ?? 33, sections)[i]) });
              }}
            >
              <option value="">Seçin…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Num label="Ad soyad başlangıç" v={def.nameStart} on={(n) => updateDef({ nameStart: n })} cls="bg-sky-100" />
          <Num label="Ad soyad uzunluk" v={def.nameLen} on={(n) => updateDef({ nameLen: n })} cls="bg-sky-100" />
          <Num label="Öğrenci no başlangıç" v={def.noStart} on={(n) => updateDef({ noStart: n })} cls="bg-amber-100" />
          <Num label="Öğrenci no uzunluk" v={def.noLen} on={(n) => updateDef({ noLen: n })} cls="bg-amber-100" />
          {bookletB && <Num label="Kitapçık sütunu" v={def.bookletStart} on={(n) => updateDef({ bookletStart: n })} cls="bg-violet-200" />}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {sections.map((s, i) => (
            <Num key={i} label={`${s.name} (${s.count} soru) başlangıç`} v={def.sectionStarts[i]} on={(n) => setStart(i, n)} cls={SEC_CLS[i % SEC_CLS.length]} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <button className="btn-primary" disabled={!!fmtError || !dirty} onClick={() => saveFormat(def)}>Biçimi bu sınava kaydet</button>
          <button className="font-medium text-brand-600" onClick={() => updateDef({ sectionStarts: contiguous(def.sectionStarts[0], sections) })}>Bölümleri arka arkaya diz</button>
          {saved && <button className="text-lead hover:text-graphite" onClick={() => saveFormat(null)}>Varsayılana dön</button>}
          {fmtError && <span className="text-red-600">{fmtError}</span>}
          {fmtMsg && <span className={fmtMsg.includes("kaydedildi") || fmtMsg.includes("dönüldü") ? "text-emerald-700" : "text-red-600"}>{fmtMsg}</span>}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">2. Dosyayı yükleyin</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="btn-primary cursor-pointer">
            TXT / DAT dosyası seç
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
          {result.skipped.length > 0 && <span className="text-amber-700"> Eşleşmeyen numaralar atlandı: {result.skipped.join(", ")}.</span>}
          {(result.badBooklet?.length ?? 0) > 0 && <span className="text-red-700"> Kitapçık türü geçersiz olduğu için kaydedilmedi: {result.badBooklet!.join(", ")}.</span>}{" "}
          <Link href={`/kurum/denemeler/${examId}?tab=sonuclar`} className="font-semibold underline">Sıralı listeyi gör</Link>
        </div>
      )}

      {parsed.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule/70 p-4">
            <h2 className="font-semibold">
              3. Önizleme · {parsed.length} satır, {matched} öğrenci eşleşti
              {parsed.length - matched > 0 && <span className="text-amber-700"> ({parsed.length - matched} eşleşmeyen atlanacak)</span>}
            </h2>
            <button className="btn-primary" disabled={busy || matched === 0 || !!fmtError} onClick={save}>
              {busy ? "Kaydediliyor…" : `${matched} sonucu kaydet`}
            </button>
          </div>
          <div className="overflow-x-auto border-b border-rule/70 bg-paper p-3 font-mono text-[11px] leading-5">
            <div className="whitespace-pre text-lead/70">{ruler}</div>
            {lines.slice(0, 3).map((l, i) => (
              <div key={i} className="whitespace-pre">{highlight(l)}</div>
            ))}
            <div className="mt-1 font-sans text-xs text-lead">İlk 3 satır · renkler biçimdeki alanları gösterir (her bölüm ayrı renk)</div>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface text-left text-lead">
                <tr>
                  <th className="px-3 py-2">Dosyadaki ad</th>
                  <th className="px-3 py-2">No</th>
                  <th className="px-3 py-2">Eşleşen öğrenci</th>
                  {bookletB && <th className="px-3 py-2">Kt.</th>}
                  <th className="px-3 py-2">Cevaplar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/70">
                {parsed.map((p, i) => (
                  <tr key={i} className={p.match ? "" : "bg-amber-50"}>
                    <td className="px-3 py-1.5">{p.name || "—"}</td>
                    <td className="px-3 py-1.5 font-mono">{p.studentNo || "—"}</td>
                    <td className="px-3 py-1.5">{p.match ?? <span className="text-amber-700">Eşleşmedi</span>}</td>
                    {bookletB && <td className={`px-3 py-1.5 font-bold ${p.bookletOk ? "" : "text-red-600"}`}>{p.booklet || "?"}</td>}
                    <td className="max-w-md truncate px-3 py-1.5 font-mono text-lead">{p.answers.replace(/ /g, "·")}</td>
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
