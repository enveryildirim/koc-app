"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CHOICES, computeLayout, FormSpec } from "./layout";
import { scanForm, ScanResult } from "./scan";
import { renderSampleScan } from "./draw";
import { qrMatrix } from "./qr";

export type KeyItem = { points: number; correct: number[]; number: number; section?: string };

type Sheet = {
  key: string;
  fileName: string;
  imageUrl: string;
  status: "processing" | "done" | "error";
  error?: string;
  scan?: ScanResult;
  overlay?: string;
  name: string;
  studentNo: string;
  booklet: string;
  answers: number[][];
};

type Props = {
  spec: FormSpec;
  /** Kitapçık türüne göre cevap anahtarı. Kitapçık alanı yoksa yalnızca A kullanılır. */
  keys: { A: KeyItem[] } & Partial<Record<string, KeyItem[]>>;
  saveUrl: string;
  resultsHref: string;
  /** "exam": öğrenci numarasıyla eşleştirme + net gösterimi */
  mode?: "test" | "exam";
  /** normalize edilmiş öğrenci no → görünen ad (exam modu) */
  students?: Record<string, string>;
  wrongPer?: number;
};

const MAX_DIM = 1800;
const SAMPLE_NAMES = ["Ali Vural", "Büşra Kılıç", "Cem Aksoy", "Dilara Tan", "Eren Uçar", "Gizem Oral"];
const norm = (s: string) => s.replace(/\D/g, "").replace(/^0+/, "") || "0";

export default function OmrScanner({ spec, keys, saveUrl, resultsHref, mode = "test", students = {}, wrongPer = 0 }: Props) {
  const layout = useMemo(() => computeLayout(spec), [spec]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ n: number; skipped: string[]; badBooklet: string[] } | null>(null);
  // Örnek üretme seçenekleri (test için): kişisel form (kimlik şeridi + QR) ve rastgele yön (ters / yan)
  const [samplePersonal, setSamplePersonal] = useState(false);
  const [sampleRotate, setSampleRotate] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Sheet>) => setSheets((s) => s.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function addImage(fileName: string, imageUrl: string) {
    const key = `${Date.now()}-${Math.random()}`;
    setSaved(null);
    setSheets((s) => [...s, { key, fileName, imageUrl, status: "processing", name: "", studentNo: "", booklet: "A", answers: [] }]);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const img = await loadImage(imageUrl);
      const ratio = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const scan = scanForm(ctx.getImageData(0, 0, canvas.width, canvas.height), layout);
      patch(key, {
        status: "done",
        scan,
        overlay: drawOverlay(canvas, scan),
        studentNo: scan.studentNo,
        booklet: scan.booklet || "A",
        answers: scan.questions.map((q) => q.marked),
      });
    } catch (e) {
      patch(key, { status: "error", error: e instanceof Error ? e.message : "Görüntü işlenemedi." });
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) await addImage(f.name, URL.createObjectURL(f));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function addSamples(n: number) {
    const known = Object.entries(students);
    for (let i = 0; i < n; i++) {
      const skill = 0.35 + Math.random() * 0.6;
      const letters = spec.booklets ?? ["A"];
      const booklet = letters[Math.floor(Math.random() * letters.length)];
      const key = keys[booklet] ?? keys.A;
      const answers = key.map((k, q) => {
        const cc = spec.questions[q].choiceCount;
        const r = Math.random();
        if (r < 0.08) return [];
        if (r < 0.095) return [0, 1];
        if (Math.random() < skill) return k.correct.slice(0, 1);
        return [Math.floor(Math.random() * cc)];
      });
      let studentNo: string;
      let name: string;
      let className = "";
      if (mode === "exam" && known.length) {
        const [no, display] = known[Math.floor(Math.random() * known.length)];
        studentNo = no.padStart(6, "0");
        name = display.split(" (")[0];
        className = display.match(/\(([^)]*)\)$/)?.[1] ?? "";
      } else {
        studentNo = String(100000 + Math.floor(Math.random() * 899999));
        name = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
      }
      const multi = letters.length > 1;
      const personal = samplePersonal && mode === "exam";
      const rotation = sampleRotate ? ([0, 90, 180, 270] as const)[Math.floor(Math.random() * 4)] : 0;
      const sheetSpec: FormSpec = personal
        ? { ...spec, personal: { studentNo: norm(studentNo), name, className, qr: qrMatrix(`örnek ${norm(studentNo)}`) } }
        : spec;
      const url = renderSampleScan(sheetSpec, { answers, studentNo, name, booklet: multi ? booklet : undefined, rotation });
      const tags = [name, multi ? booklet : "", personal ? "kişisel" : "", rotation ? `${rotation}°` : ""].filter(Boolean).join(" · ");
      await addImage(`örnek-${norm(studentNo)}.jpg (${tags})`, url);
    }
  }

  function toggle(sheetKey: string, q: number, c: number) {
    setSheets((s) =>
      s.map((x) => {
        if (x.key !== sheetKey) return x;
        return { ...x, answers: x.answers.map((a, i) => (i === q ? (a.includes(c) ? a.filter((v) => v !== c) : [c]) : a)) };
      }),
    );
  }

  const ready = sheets.filter((s) => s.status === "done");
  const unmatched = mode === "exam" ? ready.filter((s) => !students[norm(s.studentNo)]).length : 0;

  async function saveAll() {
    setSaving(true);
    const res = await fetch(saveUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheets: ready.map((s) => ({ name: s.name, studentNo: s.studentNo, booklet: s.booklet, answers: s.answers })),
      }),
    });
    setSaving(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json.error ?? "Kaydedilemedi.");
    setSaved({ n: json.saved ?? json.ids?.length ?? ready.length, skipped: json.skipped ?? [], badBooklet: json.badBooklet ?? [] });
    setSheets((s) => s.filter((x) => x.status !== "done"));
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="font-semibold">Doldurulmuş formları tarayın</h2>
        <p className="mt-1 text-sm text-lead">
          Tarayıcıdan aldığınız görüntüleri veya telefonla çektiğiniz fotoğrafları yükleyin. Birden fazla dosya seçebilirsiniz.
          İşleme tamamen tarayıcınızda yapılır.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="btn-primary cursor-pointer">
            Görüntü yükle / fotoğraf çek
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          </label>
          <button className="btn-secondary" onClick={() => addSamples(1)}>🧪 Örnek taranmış form üret</button>
          <button className="btn-secondary" onClick={() => addSamples(5)}>🧪 5 örnek üret</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-lead">
          {mode === "exam" && (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={samplePersonal} onChange={(e) => setSamplePersonal(e.target.checked)} />
              Örnekler kişisel form olsun (kimlik şeridi ve QR)
            </label>
          )}
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={sampleRotate} onChange={(e) => setSampleRotate(e.target.checked)} />
            Rastgele yön (ters ya da yan çekilmiş fotoğraf)
          </label>
        </div>
        <p className="mt-2 text-xs text-lead/70">
          “Örnek” düğmeleri test içindir: rastgele doldurulmuş, hafif döndürülmüş ve gürültülü sahte bir tarama üretip okuyucuya verir.
          {mode === "exam" && " Örnekler kayıtlı öğrencilerin numaralarıyla doldurulur."}
        </p>
      </div>

      {saved && (
        <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {saved.n} form kaydedildi.{" "}
          {saved.skipped.length > 0 && <span className="text-amber-700">Eşleşmeyen numaralar atlandı: {saved.skipped.join(", ")}. </span>}
          {saved.badBooklet.length > 0 && <span className="text-red-700">Kitapçık türü geçersiz olduğu için kaydedilmedi: {saved.badBooklet.join(", ")}. </span>}
          <Link href={resultsHref} className="font-semibold underline">Sonuçları görüntüle</Link>
        </div>
      )}

      {sheets.map((s) => (
        <SheetCard
          key={s.key}
          sheet={s}
          spec={spec}
          keys={keys}
          mode={mode}
          wrongPer={wrongPer}
          matched={students[norm(s.studentNo)]}
          onPatch={(p) => patch(s.key, p)}
          onToggle={(q, c) => toggle(s.key, q, c)}
          onRemove={() => setSheets((x) => x.filter((y) => y.key !== s.key))}
        />
      ))}

      {ready.length > 0 && (
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-graphite p-4 text-white shadow-lg">
          <span className="text-sm">
            {ready.length} form kaydedilmeye hazır
            {unmatched > 0 && <span className="ml-2 text-amber-300">· {unmatched} formun numarası kayıtlı öğrenciyle eşleşmiyor (atlanacak)</span>}
          </span>
          <button className="btn bg-surface text-graphite hover:bg-mist" disabled={saving} onClick={saveAll}>
            {saving ? "Kaydediliyor…" : "Tümünü sonuçlara kaydet"}
          </button>
        </div>
      )}
    </div>
  );
}

function SheetCard({
  sheet: s,
  spec,
  keys,
  mode,
  wrongPer,
  matched,
  onPatch,
  onToggle,
  onRemove,
}: {
  sheet: Sheet;
  spec: FormSpec;
  keys: Props["keys"];
  mode: "test" | "exam";
  wrongPer: number;
  matched?: string;
  onPatch: (p: Partial<Sheet>) => void;
  onToggle: (q: number, c: number) => void;
  onRemove: () => void;
}) {
  const [zoom, setZoom] = useState(false);
  const key = keys[s.booklet] ?? keys.A;
  let score = 0, max = 0, d = 0, y = 0, b = 0;
  key.forEach((k, i) => {
    max += k.points;
    const a = s.answers[i] ?? [];
    if (a.length === 0) b++;
    else if (a.length === k.correct.length && a.every((v) => k.correct.includes(v))) {
      score += k.points;
      d++;
    } else y++;
  });
  const net = wrongPer > 0 ? d - y / wrongPer : d;
  const problems = s.scan?.questions.filter((q) => q.status === "multiple" || q.status === "uncertain").length ?? 0;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-rule/70 px-4 py-2 text-sm">
        <span className="truncate font-medium">{s.fileName}</span>
        <button className="text-lead/70 hover:text-red-600" onClick={onRemove}>✕ Kaldır</button>
      </div>
      {s.status === "processing" && <div className="p-6 text-sm text-lead">Form okunuyor…</div>}
      {s.status === "error" && (
        <div className="flex gap-4 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.imageUrl} alt="" className="h-40 rounded object-contain ring-1 ring-rule" />
          <p className="text-sm text-red-700">{s.error}</p>
        </div>
      )}
      {s.status === "done" && s.scan && (
        <div className="grid gap-4 p-4 md:grid-cols-[220px_1fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.overlay} alt="Okunan form" onClick={() => setZoom(true)} className="w-full cursor-zoom-in rounded ring-1 ring-rule" />
            <p className="mt-1 text-center text-xs text-lead/70">Büyütmek için tıklayın</p>
          </div>
          <div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {mode === "test" ? (
                <div className="sm:col-span-2">
                  <label className="label">Ad Soyad</label>
                  <input className="input" placeholder="Formdaki adı yazın" value={s.name} onChange={(e) => onPatch({ name: e.target.value })} />
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <label className="label">Öğrenci (numaradan eşleşen)</label>
                  <div className={`input ${matched ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                    {matched ?? "Kayıtlı öğrenci bulunamadı – numarayı düzeltin"}
                  </div>
                </div>
              )}
              <div>
                <label className="label">Öğrenci no (okunan)</label>
                <input className="input num" value={s.studentNo} onChange={(e) => onPatch({ studentNo: e.target.value })} />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-lead">
              {s.scan.studentSource === "id"
                ? "Numara kişisel formun kimlik şeridinden okundu."
                : s.scan.studentSource === "invalid"
                  ? <span className="text-red-700">Kimlik şeridi okunamadı (kirli ya da katlanmış olabilir); numarayı elle girin.</span>
                  : "Numara kodlama alanından okundu."}
              {s.scan.rotation !== 0 && ` Form ${s.scan.rotation}° dönük çekilmiş; düzeltilerek okundu.`}
              {!s.scan.oriented && " Formda yön işareti yok (eski form); düz çekildiği varsayıldı."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              {(spec.booklets?.length ?? 0) > 1 && (
                <span className="flex items-center gap-1">
                  Kitapçık:
                  {spec.booklets!.map((k) => (
                    <button
                      key={k}
                      onClick={() => onPatch({ booklet: k })}
                      className={`h-7 w-7 rounded-full text-xs font-bold ${s.booklet === k ? "bg-graphite text-white" : "ring-1 ring-rule"}`}
                    >
                      {k}
                    </button>
                  ))}
                  {!s.scan.booklet && <span className="text-xs text-amber-600">(okunamadı)</span>}
                </span>
              )}
              <span className="badge bg-mist px-3 py-1 text-sm text-graphite">
                {mode === "exam" ? `${d}D ${y}Y ${b}B · ${net.toFixed(2)} net` : `${score}/${max} puan · ${d} doğru`}
              </span>
              {problems > 0 ? (
                <span className="badge bg-amber-50 px-3 py-1 text-sm text-amber-700">{problems} soruyu kontrol edin</span>
              ) : (
                <span className="badge bg-emerald-50 px-3 py-1 text-sm text-emerald-700">✓ Tüm sorular net okundu</span>
              )}
            </div>
            <div className="mt-3 grid max-h-96 grid-cols-1 gap-x-6 gap-y-1 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
              {spec.questions.map((fq, qi) => {
                const read = s.scan!.questions[qi];
                const a = s.answers[qi] ?? [];
                const flag = read.status === "multiple" || read.status === "uncertain";
                const k = key[qi];
                const newSection = k?.section && k.section !== key[qi - 1]?.section;
                return (
                  <div key={qi} className="contents">
                    {newSection && <div className="col-span-full mt-2 text-xs font-bold text-lead">{k.section}</div>}
                    <div className={`flex items-center gap-1 rounded px-1 py-0.5 ${flag ? "bg-amber-50" : ""}`}>
                      <span className="w-7 text-right text-xs font-semibold text-lead">{k?.number}.</span>
                      {CHOICES.slice(0, fq.choiceCount).map((c, ci) => {
                        const on = a.includes(ci);
                        const isKey = k?.correct.includes(ci);
                        return (
                          <button
                            key={c}
                            onClick={() => onToggle(qi, ci)}
                            className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${
                              on ? (isKey ? "bg-emerald-600 text-white" : "bg-red-500 text-white") : isKey ? "text-emerald-700 ring-1 ring-emerald-400" : "text-lead/70 ring-1 ring-rule"
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                      {flag && <span className="text-[10px] text-amber-700">{read.status === "multiple" ? "çift" : "belirsiz"}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-lead/70">
              Okunan cevabı değiştirmek için şıkka tıklayın. Yeşil halka = doğru cevap, kırmızı = yanlış işaretleme.
            </p>
          </div>
        </div>
      )}
      {zoom && s.overlay && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setZoom(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.overlay} alt="" className="max-h-full max-w-full rounded bg-surface" />
        </div>
      )}
    </div>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Görüntü yüklenemedi."));
    img.src = src;
  });
}

/** Okunan sonucu görüntünün üzerine çizer: köşe işaretleri ve işaretli baloncuklar. */
function drawOverlay(src: HTMLCanvasElement, scan: ScanResult) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(src, 0, 0);
  ctx.lineWidth = Math.max(2, c.width / 450);
  for (const [x, y] of scan.markers) {
    ctx.strokeStyle = "#2563eb";
    ctx.beginPath();
    ctx.arc(x, y, c.width / 40, 0, Math.PI * 2);
    ctx.stroke();
  }
  const all = [
    ...scan.studentBubbles.map((b) => ({ b, warn: false })),
    ...scan.questions.flatMap((q) => q.bubbles.map((b) => ({ b, warn: q.status === "multiple" || q.status === "uncertain" }))),
  ];
  for (const { b, warn } of all) {
    if (!b.marked && !warn) continue;
    ctx.strokeStyle = warn ? "#f59e0b" : "#16a34a";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 1.35, 0, Math.PI * 2);
    ctx.stroke();
  }
  return c.toDataURL("image/jpeg", 0.85);
}
