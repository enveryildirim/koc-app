"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { CHOICES, FormInfo } from "@/lib/omr/layout";
import { scanForm, ScanResult } from "@/lib/omr/scan";
import { renderSampleScan } from "@/lib/omr/draw";

type KeyItem = { points: number; correct: number[]; number: number };

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
  answers: number[][];
};

const MAX_DIM = 1400;
const SAMPLE_NAMES = ["Ali Vural", "Büşra Kılıç", "Cem Aksoy", "Dilara Tan", "Eren Uçar", "Gizem Oral"];

export default function OmrScanner({ testId, info, answerKey }: { testId: string; info: FormInfo; answerKey: KeyItem[] }) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Sheet>) => setSheets((s) => s.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function addImage(fileName: string, imageUrl: string) {
    const key = `${Date.now()}-${Math.random()}`;
    setSaved(null);
    setSheets((s) => [
      ...s,
      { key, fileName, imageUrl, status: "processing", name: "", studentNo: "", answers: [] },
    ]);
    await new Promise((r) => setTimeout(r, 30)); // arayüzün güncellenmesine izin ver
    try {
      const img = await loadImage(imageUrl);
      const ratio = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const scan = scanForm(data, info.questions);
      patch(key, {
        status: "done",
        scan,
        overlay: drawOverlay(canvas, scan),
        studentNo: scan.studentNo,
        answers: scan.questions.map((q) => q.marked),
      });
    } catch (e) {
      patch(key, { status: "error", error: e instanceof Error ? e.message : "Görüntü işlenemedi." });
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      await addImage(f.name, URL.createObjectURL(f));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function addSamples(n: number) {
    for (let i = 0; i < n; i++) {
      const skill = 0.4 + Math.random() * 0.55;
      const answers = answerKey.map((k, q) => {
        const r = Math.random();
        if (r < 0.04) return []; // boş
        if (r < 0.06) return [0, 1].slice(0, info.questions[q].choiceCount); // çift işaretleme
        if (Math.random() < skill) return k.correct.slice(0, 1);
        return [Math.floor(Math.random() * info.questions[q].choiceCount)];
      });
      const studentNo = String(100000 + Math.floor(Math.random() * 899999));
      const name = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
      const url = renderSampleScan(info, { answers, studentNo, name });
      await addImage(`örnek-${studentNo}.jpg (${name})`, url);
    }
  }

  function toggle(sheetKey: string, q: number, c: number) {
    setSheets((s) =>
      s.map((x) => {
        if (x.key !== sheetKey) return x;
        const answers = x.answers.map((a, i) => (i === q ? (a.includes(c) ? a.filter((v) => v !== c) : [c]) : a));
        return { ...x, answers };
      }),
    );
  }

  const ready = sheets.filter((s) => s.status === "done");

  async function saveAll() {
    setSaving(true);
    const res = await fetch(`/api/tests/${testId}/omr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheets: ready.map((s) => ({ name: s.name, studentNo: s.studentNo, answers: s.answers })) }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(ready.length);
      setSheets((s) => s.filter((x) => x.status !== "done"));
    } else alert("Kaydedilemedi.");
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="font-semibold">2. Doldurulmuş formları tarayın</h2>
        <p className="mt-1 text-sm text-slate-500">
          Tarayıcıdan aldığınız görüntüleri veya telefonla çektiğiniz fotoğrafları yükleyin. Birden fazla dosya seçebilirsiniz.
          İşleme tamamen tarayıcınızda yapılır.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="btn-primary cursor-pointer">
            📷 Görüntü yükle / fotoğraf çek
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          </label>
          <button className="btn-secondary" onClick={() => addSamples(1)}>🧪 Örnek taranmış form üret</button>
          <button className="btn-secondary" onClick={() => addSamples(5)}>🧪 5 örnek üret</button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          “Örnek” düğmeleri test içindir: rastgele doldurulmuş, hafif döndürülmüş ve gürültülü sahte bir tarama üretip okuyucuya verir.
        </p>
      </div>

      {saved !== null && (
        <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {saved} form kaydedildi. <Link href={`/sinav/${testId}/sonuclar`} className="font-semibold underline">Sonuçları görüntüle →</Link>
        </div>
      )}

      {sheets.map((s) => (
        <SheetCard key={s.key} sheet={s} info={info} answerKey={answerKey} onPatch={(p) => patch(s.key, p)} onToggle={(q, c) => toggle(s.key, q, c)} onRemove={() => setSheets((x) => x.filter((y) => y.key !== s.key))} />
      ))}

      {ready.length > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between rounded-xl bg-slate-900 p-4 text-white shadow-lg">
          <span className="text-sm">{ready.length} form kaydedilmeye hazır</span>
          <button className="btn bg-white text-slate-900 hover:bg-slate-100" disabled={saving} onClick={saveAll}>
            {saving ? "Kaydediliyor…" : "Tümünü sonuçlara kaydet"}
          </button>
        </div>
      )}
    </div>
  );
}

function SheetCard({
  sheet: s,
  info,
  answerKey,
  onPatch,
  onToggle,
  onRemove,
}: {
  sheet: Sheet;
  info: FormInfo;
  answerKey: KeyItem[];
  onPatch: (p: Partial<Sheet>) => void;
  onToggle: (q: number, c: number) => void;
  onRemove: () => void;
}) {
  const [zoom, setZoom] = useState(false);
  let score = 0;
  let max = 0;
  let correct = 0;
  answerKey.forEach((k, i) => {
    max += k.points;
    const a = s.answers[i] ?? [];
    if (a.length === k.correct.length && a.every((v) => k.correct.includes(v))) {
      score += k.points;
      correct++;
    }
  });
  const problems = s.scan?.questions.filter((q) => q.status === "multiple" || q.status === "uncertain").length ?? 0;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-sm">
        <span className="truncate font-medium">{s.fileName}</span>
        <button className="text-slate-400 hover:text-red-600" onClick={onRemove}>✕ Kaldır</button>
      </div>
      {s.status === "processing" && <div className="p-6 text-sm text-slate-500">Form okunuyor…</div>}
      {s.status === "error" && (
        <div className="flex gap-4 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.imageUrl} alt="" className="h-40 rounded object-contain ring-1 ring-slate-200" />
          <p className="text-sm text-red-700">⚠️ {s.error}</p>
        </div>
      )}
      {s.status === "done" && s.scan && (
        <div className="grid gap-4 p-4 md:grid-cols-[220px_1fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.overlay}
              alt="Okunan form"
              onClick={() => setZoom(true)}
              className="w-full cursor-zoom-in rounded ring-1 ring-slate-200"
            />
            <p className="mt-1 text-center text-xs text-slate-400">Büyütmek için tıklayın</p>
          </div>
          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Ad Soyad</label>
                <input className="input" placeholder="Formdaki adı yazın" value={s.name} onChange={(e) => onPatch({ name: e.target.value })} />
              </div>
              <div>
                <label className="label">Öğrenci no (okunan)</label>
                <input className="input font-mono" value={s.studentNo} onChange={(e) => onPatch({ studentNo: e.target.value })} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="badge bg-brand-50 px-3 py-1 text-sm text-brand-700">
                {score}/{max} puan · {correct} doğru
              </span>
              {problems > 0 ? (
                <span className="badge bg-amber-50 px-3 py-1 text-sm text-amber-700">⚠️ {problems} soruyu kontrol edin</span>
              ) : (
                <span className="badge bg-emerald-50 px-3 py-1 text-sm text-emerald-700">✓ Tüm sorular net okundu</span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
              {info.questions.map((fq, qi) => {
                const read = s.scan!.questions[qi];
                const a = s.answers[qi] ?? [];
                const flag = read.status === "multiple" || read.status === "uncertain";
                return (
                  <div key={qi} className={`flex items-center gap-1 rounded px-1 py-0.5 ${flag ? "bg-amber-50" : ""}`}>
                    <span className="w-7 text-right text-xs font-semibold text-slate-500">{answerKey[qi].number}.</span>
                    {CHOICES.slice(0, fq.choiceCount).map((c, ci) => {
                      const on = a.includes(ci);
                      const isKey = answerKey[qi].correct.includes(ci);
                      return (
                        <button
                          key={c}
                          onClick={() => onToggle(qi, ci)}
                          title={isKey ? "Doğru cevap" : undefined}
                          className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${
                            on ? (isKey ? "bg-emerald-600 text-white" : "bg-red-500 text-white") : isKey ? "text-emerald-700 ring-1 ring-emerald-400" : "text-slate-400 ring-1 ring-slate-200"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                    {flag && <span className="text-[10px] text-amber-700">{read.status === "multiple" ? "çift" : "belirsiz"}</span>}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Okunan cevabı değiştirmek için şıkka tıklayın. Yeşil halka = doğru cevap, kırmızı = yanlış işaretleme.
            </p>
          </div>
        </div>
      )}
      {zoom && s.overlay && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setZoom(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.overlay} alt="" className="max-h-full max-w-full rounded bg-white" />
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
  ctx.lineWidth = Math.max(2, c.width / 400);
  for (const [x, y] of scan.markers) {
    ctx.strokeStyle = "#2563eb";
    ctx.beginPath();
    ctx.arc(x, y, c.width / 40, 0, Math.PI * 2);
    ctx.stroke();
  }
  const all = [...scan.studentBubbles.map((b) => ({ b, warn: false })), ...scan.questions.flatMap((q) => q.bubbles.map((b) => ({ b, warn: q.status === "multiple" || q.status === "uncertain" })))];
  for (const { b, warn } of all) {
    if (!b.marked && !warn) continue;
    ctx.strokeStyle = warn ? "#f59e0b" : "#16a34a";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 1.35, 0, Math.PI * 2);
    ctx.stroke();
  }
  return c.toDataURL("image/jpeg", 0.85);
}
