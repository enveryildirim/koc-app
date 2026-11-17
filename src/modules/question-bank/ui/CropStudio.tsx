"use client";
import { COGNITIVE_LEVELS } from "@/shared/cognitive";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ANSWERS, DIFFICULTY, GRADES, LIMITS, detectQuestions, type Crop, type QuestionMeta, type QuestionOrigin } from "../index";

type Box = { id: string; crop: Crop; origin: QuestionOrigin; answer: string; topic: string };
type Saved = { id: string; page: number; crop: Crop; answer: string; topic: string };
type Handle = "move" | "nw" | "ne" | "sw" | "se";
type Drag = { kind: "draw" | Handle; id: string; start: { x: number; y: number }; orig: Crop };

/** Sayfa görüntüsünün hedef genişliği (px). Kesimler bu çözünürlükte alınır. */
const RENDER_W = 1700;
const MIN = 0.012;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
let seq = 0;
const newId = () => `b${++seq}`;

/** Okuma sırası: önce sol sütun, sonra sağ; sütun içinde yukarıdan aşağı. */
function readingOrder(a: Crop, b: Crop) {
  const col = (c: Crop) => (c.w < 0.6 && c.x + c.w / 2 > 0.5 ? 1 : 0);
  return col(a) - col(b) || a.y - b.y;
}

type PdfDoc = { numPages: number; getPage(n: number): Promise<PdfPage> };
type PdfPage = {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
};

async function loadPdf(url: string): Promise<PdfDoc> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const data = await (await fetch(url)).arrayBuffer();
  return (await pdfjs.getDocument({ data, isEvalSupported: false }).promise) as unknown as PdfDoc;
}

export default function CropStudio(props: {
  source: { id: string; name: string; kind: "PDF" | "IMAGE"; files: number };
  saved: Saved[];
  subjects: string[];
  topics: Record<string, string[]>;
}) {
  const { source } = props;
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PdfDoc | null>(null);

  const [pageCount, setPageCount] = useState(source.kind === "IMAGE" ? source.files : 0);
  const [page, setPage] = useState(1);
  const [rendering, setRendering] = useState(true);
  const [renderedPage, setRenderedPage] = useState(0);
  const [boxes, setBoxes] = useState<Record<number, Box[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [sensitivity, setSensitivity] = useState(3);
  const [autoDetect, setAutoDetect] = useState(true);
  const [defaults, setDefaults] = useState({ subject: "", topic: "", grade: "", difficulty: 2, level: "", sourceNote: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pageBoxes = useMemo(() => [...(boxes[page] ?? [])].sort((a, b) => readingOrder(a.crop, b.crop)), [boxes, page]);
  const pageSaved = props.saved.filter((s) => s.page === page);
  const unsaved = Object.values(boxes).reduce((n, l) => n + l.length, 0);
  const setPageBoxes = useCallback((fn: (l: Box[]) => Box[]) => setBoxes((b) => ({ ...b, [page]: fn(b[page] ?? []) })), [page]);

  // Kaydedilmemiş kutu varken sayfadan çıkmadan önce uyar.
  useEffect(() => {
    if (!unsaved) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [unsaved]);

  // Sayfayı tuvale çiz.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRendering(true);
      setMsg(null);
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      try {
        if (source.kind === "PDF") {
          pdfRef.current ??= await loadPdf(`/api/kurum/soru-havuzu/kaynaklar/${source.id}/dosya/0`);
          if (cancelled) return;
          setPageCount(pdfRef.current.numPages);
          const p = await pdfRef.current.getPage(page);
          const scale = Math.min(3, RENDER_W / p.getViewport({ scale: 1 }).width);
          const vp = p.getViewport({ scale });
          canvas.width = Math.round(vp.width);
          canvas.height = Math.round(vp.height);
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await p.render({ canvasContext: ctx, viewport: vp }).promise;
        } else {
          const img = new Image();
          img.src = `/api/kurum/soru-havuzu/kaynaklar/${source.id}/dosya/${page - 1}`;
          await img.decode();
          const scale = Math.min(1, 2400 / img.naturalWidth);
          canvas.width = Math.round(img.naturalWidth * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        if (!cancelled) setRenderedPage(page);
      } catch {
        if (!cancelled) setMsg({ ok: false, text: "Sayfa açılamadı. Dosya bozuk olabilir." });
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, source.id, source.kind]);

  /** Kesilmiş bölgelerle çakışmayan otomatik kutular üretir; elle çizilenler korunur. */
  const detect = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || renderedPage !== page) return;
    const found = detectQuestions(canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height), { sensitivity });
    const overlaps = (a: Crop, b: Crop) => {
      const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      return ix * iy > 0.5 * Math.min(a.w * a.h, b.w * b.h);
    };
    const fresh = found.filter((f) => !pageSaved.some((s) => overlaps(s.crop, f)));
    setPageBoxes((l) => [
      ...l.filter((b) => b.origin !== "AUTO"),
      ...fresh.filter((f) => !l.some((b) => b.origin !== "AUTO" && overlaps(b.crop, f))).map((c) => ({ id: newId(), crop: { x: c.x, y: c.y, w: c.w, h: c.h }, origin: "AUTO" as const, answer: "", topic: "" })),
    ]);
    setSelected(null);
    if (!fresh.length) setMsg({ ok: false, text: "Bu sayfada yeni soru bulunamadı. Hassasiyeti değiştirin ya da kutuları elle çizin." });
  }, [sensitivity, pageSaved, setPageBoxes, renderedPage, page]);

  // Sayfa ilk kez açıldığında (kutu ve kayıt yoksa) otomatik bul.
  const detectedPages = useRef(new Set<number>());
  useEffect(() => {
    if (renderedPage !== page || rendering || !autoDetect || detectedPages.current.has(page)) return;
    detectedPages.current.add(page);
    if (!(boxes[page]?.length) && !pageSaved.length) detect();
  }, [renderedPage, rendering, autoDetect, page, boxes, pageSaved.length, detect]);

  // Klavye: Delete siler, A–E seçili kutunun cevabı, ←/→ sayfa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, select, textarea")) return;
      if (selected && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        setPageBoxes((l) => l.filter((b) => b.id !== selected));
        setSelected(null);
      } else if (selected && /^[a-eA-E]$/.test(e.key) && !e.metaKey && !e.ctrlKey) {
        const a = e.key.toUpperCase();
        setPageBoxes((l) => l.map((b) => (b.id === selected ? { ...b, answer: b.answer === a ? "" : a } : b)));
        // Sıradaki kutuya geç.
        const i = pageBoxes.findIndex((b) => b.id === selected);
        if (pageBoxes[i + 1]) setSelected(pageBoxes[i + 1].id);
      } else if (e.key === "ArrowRight" && page < pageCount) setPage(page + 1);
      else if (e.key === "ArrowLeft" && page > 1) setPage(page - 1);
      else if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, setPageBoxes, pageBoxes, page, pageCount]);

  /* --- Fareyle çizme / taşıma / boyutlandırma --- */
  const point = (e: React.PointerEvent) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || rendering || renderedPage !== page) return;
    const p = point(e);
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-box]");
    overlayRef.current!.setPointerCapture(e.pointerId);
    if (el) {
      const id = el.dataset.box!;
      const box = pageBoxes.find((b) => b.id === id);
      if (!box) return;
      setSelected(id);
      setDrag({ kind: ((e.target as HTMLElement).dataset.handle as Handle) ?? "move", id, start: p, orig: box.crop });
    } else {
      const id = newId();
      setPageBoxes((l) => [...l, { id, crop: { x: p.x, y: p.y, w: 0, h: 0 }, origin: "MANUAL", answer: "", topic: "" }]);
      setSelected(id);
      setDrag({ kind: "draw", id, start: p, orig: { x: p.x, y: p.y, w: 0, h: 0 } });
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const p = point(e);
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;
    const o = drag.orig;
    let c: Crop;
    if (drag.kind === "draw") {
      c = { x: Math.min(p.x, drag.start.x), y: Math.min(p.y, drag.start.y), w: Math.abs(dx), h: Math.abs(dy) };
    } else if (drag.kind === "move") {
      c = { ...o, x: clamp(o.x + dx, 0, 1 - o.w), y: clamp(o.y + dy, 0, 1 - o.h) };
    } else {
      let [l, t, r, b] = [o.x, o.y, o.x + o.w, o.y + o.h];
      if (drag.kind.includes("w")) l = clamp(Math.min(l + dx, r - MIN));
      if (drag.kind.includes("e")) r = clamp(Math.max(r + dx, l + MIN));
      if (drag.kind.includes("n")) t = clamp(Math.min(t + dy, b - MIN));
      if (drag.kind.includes("s")) b = clamp(Math.max(b + dy, t + MIN));
      c = { x: l, y: t, w: r - l, h: b - t };
    }
    setPageBoxes((l) => l.map((b) => (b.id === drag.id ? { ...b, crop: c } : b)));
  }

  function onPointerUp() {
    if (drag?.kind === "draw") {
      const b = (boxes[page] ?? []).find((x) => x.id === drag.id);
      if (!b || b.crop.w < MIN || b.crop.h < MIN) {
        setPageBoxes((l) => l.filter((x) => x.id !== drag.id));
        setSelected(null);
      }
    }
    setDrag(null);
  }

  /* --- Kaydetme --- */
  function cropBlob(c: Crop) {
    const src = canvasRef.current!;
    const out = document.createElement("canvas");
    const sx = Math.round(c.x * src.width);
    const sy = Math.round(c.y * src.height);
    out.width = Math.max(1, Math.round(c.w * src.width));
    out.height = Math.max(1, Math.round(c.h * src.height));
    out.getContext("2d")!.drawImage(src, sx, sy, out.width, out.height, 0, 0, out.width, out.height);
    return new Promise<Blob>((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error("crop"))), "image/png"));
  }

  async function save() {
    if (!defaults.subject.trim()) return setMsg({ ok: false, text: "Kaydetmeden önce ders seçin." });
    const list = pageBoxes.slice(0, LIMITS.batch);
    if (!list.length) return;
    setBusy(true);
    setMsg(null);
    const form = new FormData();
    form.set("sourceId", source.id);
    const metas: QuestionMeta[] = list.map((b) => ({
      page,
      crop: b.crop,
      subject: defaults.subject.trim(),
      topic: b.topic.trim() || defaults.topic.trim(),
      grade: defaults.grade,
      difficulty: defaults.difficulty,
      level: defaults.level,
      // Kaynak notu boşsa kartta dosya adı ve sayfa görünür; not yazılırsa sayfa numarası eklenir
      sourceNote: defaults.sourceNote.trim() ? `${defaults.sourceNote.trim()}, s. ${page}` : "",
      answer: b.answer,
      origin: b.origin,
    }));
    form.set("meta", JSON.stringify(metas));
    try {
      for (const b of list) form.append("images", await cropBlob(b.crop), "soru.png");
    } catch {
      setBusy(false);
      return setMsg({ ok: false, text: "Görseller hazırlanamadı." });
    }
    const res = await fetch("/api/kurum/soru-havuzu/sorular", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Kaydedilemedi." });
    const ids = new Set(list.map((b) => b.id));
    setPageBoxes((l) => l.filter((b) => !ids.has(b.id)));
    setSelected(null);
    const missing = list.filter((b) => !b.answer).length;
    setMsg({ ok: true, text: `${json.created} soru havuza eklendi.${missing ? ` ${missing} sorunun cevabı boş; havuzdan girebilirsiniz.` : ""}` });
    router.refresh();
  }

  const topicOptions = props.topics[defaults.subject] ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
      {/* Sayfa */}
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Önceki sayfa">‹</button>
          <span className="num text-sm">
            Sayfa{" "}
            <input
              type="number"
              min={1}
              max={pageCount || 1}
              value={page}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 1 && n <= pageCount) setPage(n);
              }}
              className="input inline-block w-16 py-0.5 text-center"
              aria-label="Sayfa numarası"
            />{" "}
            / {pageCount || "…"}
          </span>
          <button className="btn-secondary" disabled={!pageCount || page >= pageCount} onClick={() => setPage(page + 1)} aria-label="Sonraki sayfa">›</button>
          <span className="ml-auto text-[13px] text-lead">
            {pageSaved.length > 0 && <>{pageSaved.length} kayıtlı · </>}
            {pageBoxes.length} yeni kutu
          </span>
        </div>

        <div
          ref={overlayRef}
          className={`relative touch-none select-none rounded-md bg-white ring-1 ring-rule ${rendering ? "opacity-50" : ""} ${drag ? "" : "cursor-crosshair"}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas ref={canvasRef} className="block h-auto w-full" />
          {pageSaved.map((s) => (
            <div
              key={s.id}
              className="pointer-events-none absolute border border-emerald-600/70 bg-emerald-500/10"
              style={{ left: `${s.crop.x * 100}%`, top: `${s.crop.y * 100}%`, width: `${s.crop.w * 100}%`, height: `${s.crop.h * 100}%` }}
            >
              <span className="absolute right-0 bottom-full rounded-t bg-emerald-700 px-1 text-[11px] font-semibold text-white">Kayıtlı{s.answer && ` · ${s.answer}`}</span>
            </div>
          ))}
          {pageBoxes.map((b, i) => {
            const sel = b.id === selected;
            return (
              <div
                key={b.id}
                data-box={b.id}
                className={`absolute cursor-move border-2 ${sel ? "border-ink bg-ink/10" : b.origin === "AUTO" ? "border-dashed border-graphite/70 bg-graphite/5" : "border-graphite bg-graphite/5"}`}
                style={{ left: `${b.crop.x * 100}%`, top: `${b.crop.y * 100}%`, width: `${b.crop.w * 100}%`, height: `${b.crop.h * 100}%` }}
              >
                <span className={`absolute bottom-full -left-0.5 rounded-t px-1.5 text-[12px] font-semibold text-white ${sel ? "bg-ink" : "bg-graphite"}`}>
                  {i + 1}
                  {b.answer && ` · ${b.answer}`}
                </span>
                {sel &&
                  (["nw", "ne", "sw", "se"] as const).map((h) => (
                    <span
                      key={h}
                      data-handle={h}
                      className={`absolute size-3 border-2 border-ink bg-white ${h[0] === "n" ? "-top-1.5" : "-bottom-1.5"} ${h[1] === "w" ? "-left-1.5" : "-right-1.5"} ${h === "nw" || h === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize"}`}
                    />
                  ))}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-lead">
          Boş alana sürükleyerek kutu çizin; kutuyu taşıyın ya da köşesinden boyutlandırın. Seçili kutuda <b>A–E</b> cevabı işaretler ve sıradakine geçer,{" "}
          <b>Delete</b> siler, <b>← →</b> sayfa değiştirir.
        </p>
      </div>

      {/* Yan panel */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
        <section className="card p-3">
          <h2 className="mb-2 text-sm font-semibold">Bu kaynaktaki sorular için</h2>
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2">
              <span className="label">Ders</span>
              <input className="input" list="qb-subjects" value={defaults.subject} onChange={(e) => setDefaults({ ...defaults, subject: e.target.value })} placeholder="Ör. Matematik" />
            </label>
            <label className="col-span-2">
              <span className="label">Konu</span>
              <input className="input" list="qb-topics" value={defaults.topic} onChange={(e) => setDefaults({ ...defaults, topic: e.target.value })} placeholder="Ör. Üslü sayılar" />
            </label>
            <label>
              <span className="label">Düzey</span>
              <select className="input" value={defaults.grade} onChange={(e) => setDefaults({ ...defaults, grade: e.target.value })}>
                <option value="">—</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{/^\d+$/.test(g) ? `${g}. sınıf` : g}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Zorluk</span>
              <select className="input" value={defaults.difficulty} onChange={(e) => setDefaults({ ...defaults, difficulty: Number(e.target.value) })}>
                {Object.entries(DIFFICULTY).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Bilişsel düzey</span>
              <select className="input" value={defaults.level} onChange={(e) => setDefaults({ ...defaults, level: e.target.value })}>
                <option value="">—</option>
                {COGNITIVE_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="col-span-full">
              <span className="label">Kaynak notu <span className="font-normal text-lead">(isteğe bağlı; sayfa numarası eklenir)</span></span>
              <input className="input" maxLength={180} value={defaults.sourceNote} onChange={(e) => setDefaults({ ...defaults, sourceNote: e.target.value })} placeholder="Ör. X Yayınları 9. Sınıf Soru Bankası, 2025" />
            </label>
          </div>
          <datalist id="qb-subjects">{props.subjects.map((s) => <option key={s} value={s} />)}</datalist>
          <datalist id="qb-topics">{topicOptions.map((s) => <option key={s} value={s} />)}</datalist>
        </section>

        <section className="card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Otomatik bul</h2>
            <label className="flex items-center gap-1.5 text-xs text-lead">
              <input type="checkbox" checked={autoDetect} onChange={(e) => setAutoDetect(e.target.checked)} />
              Sayfa açılınca
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-lead">
            Az böl
            <input type="range" min={1} max={5} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} className="flex-1 accent-graphite" aria-label="Bölme hassasiyeti" />
            Çok böl
          </label>
          <button className="btn-secondary mt-2 w-full" disabled={rendering} onClick={detect}>Bu sayfada yeniden bul</button>
          <p className="mt-1.5 text-xs text-lead">Elle çizdiğiniz kutular korunur, yalnızca otomatik kutular (kesik çizgili) yenilenir.</p>
        </section>

        <section className="card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Bu sayfadaki kutular</h2>
            {pageBoxes.length > 0 && (
              <button className="text-xs text-lead hover:text-graphite" onClick={() => setPageBoxes(() => [])}>Temizle</button>
            )}
          </div>
          {pageBoxes.length === 0 ? (
            <p className="text-xs text-lead">Kutu yok. Sayfada sürükleyerek çizin.</p>
          ) : (
            <ol className="flex max-h-[42vh] flex-col gap-1 overflow-y-auto">
              {pageBoxes.map((b, i) => (
                <li
                  key={b.id}
                  className={`flex items-center gap-1.5 rounded px-1.5 py-1 ${b.id === selected ? "bg-ink-soft" : "hover:bg-paper"}`}
                  onClick={() => setSelected(b.id)}
                >
                  <span className="num w-5 text-right text-xs font-semibold">{i + 1}</span>
                  <div className="flex gap-0.5" role="group" aria-label={`${i + 1}. soru cevabı`}>
                    {ANSWERS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        aria-pressed={b.answer === a}
                        onClick={() => setPageBoxes((l) => l.map((x) => (x.id === b.id ? { ...x, answer: x.answer === a ? "" : a } : x)))}
                        className={`size-6 rounded-full border text-[11px] font-semibold ${b.answer === a ? "border-graphite bg-graphite text-white" : "border-ink/40 text-lead hover:border-graphite"}`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  <input
                    className="input min-w-0 flex-1 px-1.5 py-0.5 text-xs"
                    list="qb-topics"
                    placeholder={defaults.topic || "Konu"}
                    value={b.topic}
                    onChange={(e) => setPageBoxes((l) => l.map((x) => (x.id === b.id ? { ...x, topic: e.target.value } : x)))}
                    aria-label={`${i + 1}. soru konusu`}
                  />
                  <button
                    type="button"
                    className="px-1 text-lead hover:text-red-700"
                    aria-label={`${i + 1}. kutuyu sil`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPageBoxes((l) => l.filter((x) => x.id !== b.id));
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
          )}
          <button className="btn-primary mt-3 w-full" disabled={busy || !pageBoxes.length} onClick={save}>
            {busy ? "Kaydediliyor…" : `Havuza ekle (${pageBoxes.length} soru)`}
          </button>
          {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
          {unsaved > pageBoxes.length && (
            <p className="mt-1 text-xs text-lead">Diğer sayfalarda {unsaved - pageBoxes.length} kaydedilmemiş kutu var.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
