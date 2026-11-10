"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { COGNITIVE_LEVELS } from "@/shared/cognitive";
import {
  answerLabel,
  countBlanks,
  DIFFICULTY,
  LIMITS,
  MAX_OPTIONS,
  OPTION_LETTERS,
  PASTE_SAMPLE,
  QUESTION_TYPES,
  splitFill,
  splitPasted,
  TYPE_ORDER,
  type DraftQuestion,
  type QuestionType,
  type WrittenMeta,
} from "../index";
import QuestionView from "./QuestionView";

type Common = { subject: string; topic: string; grade: string; difficulty: number; level: string; optionCount: number };
export type EditItem = {
  id: string;
  type: string;
  stem: string;
  options: string[];
  answer: string;
  subject: string;
  topic: string;
  grade: string;
  difficulty: number;
  level: string;
  hasImage: boolean;
};

const COMMON_KEY = "qb-writer-common";
const API_NEW = "/api/kurum/soru-havuzu/yaz";
const API_ITEM = (id: string) => `/api/kurum/soru-havuzu/sorular/${id}`;
const DEFAULT_COMMON: Common = { subject: "", topic: "", grade: "", difficulty: 2, level: "", optionCount: 4 };

function loadCommon(): Common {
  try {
    const raw = localStorage.getItem(COMMON_KEY);
    return raw ? { ...DEFAULT_COMMON, ...JSON.parse(raw) } : DEFAULT_COMMON;
  } catch {
    return DEFAULT_COMMON;
  }
}
function saveCommon(c: Common) {
  try {
    localStorage.setItem(COMMON_KEY, JSON.stringify(c));
  } catch {}
}

/** Büyük ya da desteklenmeyen görseli tarayıcıda küçültür (en uzun kenar 1800 px, JPEG). */
async function fitImage(file: File): Promise<File> {
  const ok = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
  if (ok && file.size <= LIMITS.cropMB * 1024 * 1024 * 0.9) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.88));
  if (!blob) throw new Error("Görsel işlenemedi.");
  return new File([blob], "gorsel.jpg", { type: "image/jpeg" });
}

/** Kaydı engelleyen sorunlar (sunucu da aynılarını denetler); cevap eksikliği engellemez. */
function blocking(d: { type: string; stem: string; options: string[]; hasImage?: boolean }) {
  if (!d.stem.trim() && !d.hasImage) return "Soru metni boş";
  if (d.type === "MC") {
    const o = trimOptions(d.options);
    if (o.length < 2) return "En az iki şık gerekli";
    if (o.some((x) => !x.trim())) return "Boş şık var";
  }
  if (d.type === "FILL" && !countBlanks(d.stem)) return "Boşluk (___) yok";
  return "";
}
const trimOptions = (o: string[]) => {
  const l = [...o];
  while (l.length > 2 && !l[l.length - 1].trim()) l.pop();
  return l;
};

type Props = { subjects: string[]; topics: Record<string, string[]>; grades: string[]; edit?: EditItem | null; initialMode?: "tek" | "yapistir" };

/** Soru yazma: tek tek (önizlemeli) ya da metni yapıştırıp sorulara bölerek. Ortak etiketler (ders, düzey, konu…) hatırlanır. */
export default function QuestionWriter({ subjects, topics, grades, edit, initialMode = "tek" }: Props) {
  const [common, setCommonState] = useState<Common>(() =>
    edit ? { ...DEFAULT_COMMON, subject: edit.subject, topic: edit.topic, grade: edit.grade, difficulty: edit.difficulty, level: edit.level } : DEFAULT_COMMON,
  );
  useEffect(() => {
    if (!edit) setCommonState(loadCommon());
  }, [edit]);
  const setCommon = (p: Partial<Common>) =>
    setCommonState((c) => {
      const n = { ...c, ...p };
      if (!edit) saveCommon(n);
      return n;
    });
  const [mode, setMode] = useState<"tek" | "yapistir">(edit ? "tek" : initialMode);
  const topicList = (common.subject && topics[common.subject]) || [...new Set(Object.values(topics).flat())];

  return (
    <div>
      <div className="card mb-3 flex flex-wrap items-end gap-2 px-3 py-2.5">
        <label className="w-40">
          <span className="text-xs text-lead">Ders</span>
          <input className="input" list="qw-subjects" value={common.subject} onChange={(e) => setCommon({ subject: e.target.value })} placeholder="Seçin ya da yazın" />
        </label>
        <label>
          <span className="text-xs text-lead">Düzey</span>
          <select className="input" value={common.grade} onChange={(e) => setCommon({ grade: e.target.value })}>
            <option value="">—</option>
            {grades.map((g) => <option key={g} value={g}>{/^\d+$/.test(g) ? `${g}. sınıf` : g}</option>)}
          </select>
        </label>
        <label className="min-w-48 flex-1">
          <span className="text-xs text-lead">Konu</span>
          <input className="input" list="qw-topics" value={common.topic} onChange={(e) => setCommon({ topic: e.target.value })} placeholder={topicList.length ? "Müfredattan seçin" : "İsteğe bağlı"} />
        </label>
        <label>
          <span className="text-xs text-lead">Zorluk</span>
          <select className="input" value={common.difficulty} onChange={(e) => setCommon({ difficulty: Number(e.target.value) })}>
            {Object.entries(DIFFICULTY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>
          <span className="text-xs text-lead">Bilişsel düzey</span>
          <select className="input" value={common.level} onChange={(e) => setCommon({ level: e.target.value })}>
            <option value="">—</option>
            {COGNITIVE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <datalist id="qw-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="qw-topics">{topicList.map((s) => <option key={s} value={s} />)}</datalist>
        {!edit && <p className="w-full text-xs text-lead">Bu bilgiler kaydettiğiniz her soruya yazılır ve bir sonraki soru için hatırlanır.</p>}
      </div>

      {!edit && (
        <div className="mb-3 flex gap-1" role="tablist">
          {([["tek", "Tek tek yaz"], ["yapistir", "Yapıştır ve böl"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`rounded-md px-3 py-1 text-[13.5px] ${mode === k ? "bg-graphite font-semibold text-surface" : "text-lead ring-1 ring-rule hover:text-graphite"}`}>
              {l}
            </button>
          ))}
        </div>
      )}

      {mode === "tek" ? <SingleWriter common={common} setCommon={setCommon} edit={edit} /> : <PasteSplitter common={common} />}
    </div>
  );
}

const tagsOf = (c: Common) => ({ subject: c.subject.trim(), topic: c.topic.trim(), grade: c.grade, difficulty: c.difficulty, level: c.level });

/* ------------------------------------------------------------------ Tek tek yaz */

type Draft = { type: QuestionType; stem: string; options: string[]; answer: string; fill: string[] };
const emptyDraft = (type: QuestionType, n: number): Draft => ({ type, stem: "", options: Array(n).fill(""), answer: "", fill: [] });

function SingleWriter({ common, setCommon, edit }: { common: Common; setCommon: (p: Partial<Common>) => void; edit?: EditItem | null }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() =>
    edit
      ? {
          type: (edit.type in QUESTION_TYPES ? edit.type : "MC") as QuestionType,
          stem: edit.stem,
          options: edit.options.length ? edit.options : Array(4).fill(""),
          answer: edit.type === "FILL" ? "" : edit.answer,
          fill: edit.type === "FILL" ? splitFill(edit.answer) : [],
        }
      : emptyDraft("MC", 4),
  );
  // Yeni soruda şık sayısı hatırlanır (yüklendikten sonra uygula)
  const appliedCount = useRef(false);
  useEffect(() => {
    if (edit || appliedCount.current) return;
    appliedCount.current = true;
    setD((x) => (x.stem || x.options.some(Boolean) ? x : { ...x, options: Array(common.optionCount).fill("") }));
  }, [common.optionCount, edit]);

  const [image, setImage] = useState<File | null>(null);
  const [keepImage, setKeepImage] = useState(!!edit?.hasImage);
  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const imageSrc = previewUrl ?? (keepImage && edit ? `${API_ITEM(edit.id)}/gorsel` : null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState<{ type: string; text: string }[]>([]);
  const stemRef = useRef<HTMLTextAreaElement>(null);
  const optRefs = useRef<(HTMLInputElement | null)[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [focusOpt, setFocusOpt] = useState<number | null>(null);
  useEffect(() => {
    if (focusOpt === null) return;
    optRefs.current[focusOpt]?.focus();
    setFocusOpt(null);
  }, [focusOpt]);

  const blanks = countBlanks(d.stem);
  const fill = Array.from({ length: blanks }, (_, i) => d.fill[i] ?? "");
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const setOption = (i: number, v: string) => set({ options: d.options.map((o, k) => (k === i ? v : o)) });

  async function attach(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setMsg({ ok: false, text: "Yalnızca resim eklenebilir (PNG, JPG, WEBP)." });
    try {
      setImage(await fitImage(file));
      setMsg(null);
    } catch {
      setMsg({ ok: false, text: "Bu görsel açılamadı. PNG ya da JPG deneyin." });
    }
  }

  function insertBlank() {
    const el = stemRef.current;
    const at = el ? el.selectionStart : d.stem.length;
    const end = el ? el.selectionEnd : at;
    const before = d.stem.slice(0, at);
    const pad = before && !/\s$/.test(before) ? " " : "";
    const stem = `${before}${pad}___ ${d.stem.slice(end).replace(/^\s+/, "")}`;
    set({ stem });
    el?.focus();
    const pos = before.length + pad.length + 4;
    requestAnimationFrame(() => el?.setSelectionRange(pos, pos));
  }

  function optionKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      if (i < d.options.length - 1) setFocusOpt(i + 1);
      else if (d.options.length < MAX_OPTIONS) {
        set({ options: [...d.options, ""] });
        setFocusOpt(i + 1);
      }
    } else if (e.key === "Backspace" && !d.options[i] && d.options.length > 2) {
      e.preventDefault();
      const letter = OPTION_LETTERS[i];
      set({ options: d.options.filter((_, k) => k !== i), answer: d.answer === letter ? "" : d.answer && d.answer > letter ? OPTION_LETTERS[OPTION_LETTERS.indexOf(d.answer as never) - 1] : d.answer });
      setFocusOpt(Math.max(0, i - 1));
    }
  }

  /** Birden çok satır yapıştırılırsa şıklara dağıtılır ("A) " gibi önekler atılır). */
  function optionPaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const t = e.clipboardData.getData("text/plain");
    const lines = t.split(/\r?\n/).map((l) => l.replace(/^\s*[A-Ea-e]\s*[).:\-]\s*/, "").trim()).filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    const opts = [...d.options];
    lines.slice(0, MAX_OPTIONS - i).forEach((l, k) => (opts[i + k] = l));
    set({ options: opts.slice(0, MAX_OPTIONS) });
  }

  function stemPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (file && !e.clipboardData.getData("text/plain").trim()) {
      e.preventDefault();
      attach(file);
    }
  }

  const answerValue = d.type === "FILL" ? fill : d.answer;
  const problem = blocking({ type: d.type, stem: d.stem, options: d.options, hasImage: !!imageSrc });
  const missingAnswer = d.type === "FILL" ? fill.some((x) => !x.trim()) : d.type !== "OPEN" && !d.answer;

  async function save(next: "new" | "back") {
    if (!common.subject.trim()) return setMsg({ ok: false, text: "Önce dersi seçin." });
    if (problem) return setMsg({ ok: false, text: problem + "." });
    const meta: WrittenMeta = { type: d.type, stem: d.stem, options: d.type === "MC" ? trimOptions(d.options) : undefined, answer: d.type === "FILL" && fill.every((x) => !x.trim()) ? "" : answerValue, ...tagsOf(common) };
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    let res: Response;
    if (edit) {
      fd.set("meta", JSON.stringify(meta));
      if (image) fd.set("image", image);
      else if (!keepImage && edit.hasImage) fd.set("removeImage", "1");
      res = await fetch(API_ITEM(edit.id), { method: "PUT", body: fd });
    } else {
      fd.set("meta", JSON.stringify([meta]));
      if (image) fd.set("image_0", image);
      res = await fetch(API_NEW, { method: "POST", body: fd });
    }
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Kaydedilemedi." });
    if (edit) {
      router.push("/kurum/soru-havuzu");
      router.refresh();
      return;
    }
    if (d.type === "MC") setCommon({ optionCount: Math.max(2, trimOptions(d.options).length) });
    if (next === "back") {
      router.push("/kurum/soru-havuzu");
      return;
    }
    setSaved((l) => [{ type: d.type, text: d.stem.trim().split("\n")[0].slice(0, 90) || "(görselli soru)" }, ...l]);
    setMsg({ ok: true, text: missingAnswer ? "Kaydedildi; cevabı girilmedi (havuzda “cevabı girilmemiş” listesinde)." : "Kaydedildi." });
    setD(emptyDraft(d.type, d.type === "MC" ? Math.max(2, trimOptions(d.options).length) : common.optionCount));
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
    requestAnimationFrame(() => stemRef.current?.focus());
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!busy) save("new");
    }
  };

  const previewContent = { stem: d.stem, options: d.type === "MC" ? trimOptions(d.options) : undefined };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" onKeyDown={onKeyDown}>
      <section
        className="min-w-0"
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
        onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); attach(e.dataTransfer.files[0]); } }}
      >
        <div className="mb-2 flex flex-wrap gap-1" role="radiogroup" aria-label="Soru türü">
          {TYPE_ORDER.map((t) => (
            <button key={t} role="radio" aria-checked={d.type === t} onClick={() => set({ type: t, answer: t === d.type ? d.answer : "" })} className={`rounded-md px-3 py-1.5 text-sm ${d.type === t ? "bg-graphite font-semibold text-white" : "ring-1 ring-rule hover:text-graphite"}`}>
              {QUESTION_TYPES[t].label}
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs text-lead">{QUESTION_TYPES[d.type].hint}</p>

        <label className="block">
          <span className="label">{d.type === "TF" ? "Yargı" : "Soru"}</span>
          <textarea
            ref={stemRef}
            dir="auto"
            autoFocus={!edit}
            className="input min-h-28 resize-y leading-relaxed"
            rows={Math.min(14, Math.max(4, d.stem.split("\n").length + 1))}
            value={d.stem}
            onChange={(e) => {
              set({ stem: e.target.value });
              if (msg?.ok) setMsg(null);
            }}
            onPaste={stemPaste}
            placeholder={d.type === "FILL" ? "Ör. Günde beş vakit kılınan namazlardan ilki ___ namazıdır." : d.type === "TF" ? "Ör. Kur'an-ı Kerim 114 sureden oluşur." : "Soru metni. Ekran görüntüsünü buraya Ctrl+V ile yapıştırabilirsiniz."}
          />
        </label>

        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px]">
          {d.type === "FILL" && <button type="button" className="btn-secondary py-1" onClick={insertBlank}>+ Boşluk ekle</button>}
          <button type="button" className="btn-secondary py-1" onClick={() => fileRef.current?.click()}>{imageSrc ? "Görseli değiştir" : "+ Görsel / şekil ekle"}</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => attach(e.target.files?.[0])} />
          {imageSrc && (
            <button type="button" className="text-lead hover:text-red-700" onClick={() => { setImage(null); setKeepImage(false); if (fileRef.current) fileRef.current.value = ""; }}>
              Görseli kaldır
            </button>
          )}
          <span className="text-xs text-lead">Resmi soru kutusuna yapıştırabilir ya da sürükleyebilirsiniz.</span>
        </div>
        {imageSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- yerel önizleme / kimlik doğrulamalı görsel
          <img src={imageSrc} alt="Eklenen görsel" className="mt-2 max-h-40 rounded ring-1 ring-rule" />
        )}

        {d.type === "MC" && (
          <fieldset className="mt-3">
            <legend className="label">Şıklar <span className="font-normal text-lead">— doğru şıkkın harfine tıklayın; Enter sonraki şık</span></legend>
            <ol className="space-y-1.5">
              {d.options.map((o, i) => {
                const l = OPTION_LETTERS[i];
                const on = d.answer === l;
                return (
                  <li key={i} className="flex items-center gap-2">
                    <button type="button" aria-pressed={on} aria-label={`${l} doğru cevap`} onClick={() => set({ answer: on ? "" : l })} className={`size-8 shrink-0 rounded-full border text-sm font-semibold ${on ? "border-emerald-700 bg-emerald-700 text-white" : "border-ink/40 text-lead hover:border-graphite"}`}>
                      {l}
                    </button>
                    <input ref={(el) => { optRefs.current[i] = el; }} dir="auto" className="input" value={o} onChange={(e) => setOption(i, e.target.value)} onKeyDown={(e) => optionKey(i, e)} onPaste={(e) => optionPaste(i, e)} placeholder={`${l} şıkkı`} />
                    {d.options.length > 2 && (
                      <button type="button" aria-label={`${l} şıkkını sil`} className="px-1 text-lead hover:text-red-700" onClick={() => { set({ options: d.options.filter((_, k) => k !== i), answer: "" }); }}>✕</button>
                    )}
                  </li>
                );
              })}
            </ol>
            {d.options.length < MAX_OPTIONS && (
              <button type="button" className="mt-1.5 text-[13px] text-lead hover:text-graphite" onClick={() => { set({ options: [...d.options, ""] }); setFocusOpt(d.options.length); }}>
                + {OPTION_LETTERS[d.options.length]} şıkkı ekle
              </button>
            )}
          </fieldset>
        )}

        {d.type === "TF" && (
          <div className="mt-3">
            <span className="label">Doğru cevap</span>
            <div className="flex gap-2">
              {([["D", "Doğru"], ["Y", "Yanlış"]] as const).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={d.answer === v} onClick={() => set({ answer: d.answer === v ? "" : v })} className={`rounded-md px-5 py-2 text-sm font-semibold ${d.answer === v ? "bg-emerald-700 text-white" : "ring-1 ring-rule hover:ring-graphite"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {d.type === "FILL" && (
          <div className="mt-3">
            <span className="label">Boşlukların cevabı</span>
            {blanks === 0 ? (
              <p className="text-sm text-lead">Soruya en az bir boşluk ekleyin (___ ya da “+ Boşluk ekle”).</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {fill.map((v, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-16 shrink-0 text-lead">{i + 1}. boşluk</span>
                    <input dir="auto" className="input" value={v} onChange={(e) => set({ fill: fill.map((x, k) => (k === i ? e.target.value : x)) })} />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {d.type === "OPEN" && (
          <label className="mt-3 block">
            <span className="label">Örnek cevap / puanlama notu <span className="font-normal text-lead">(isteğe bağlı)</span></span>
            <textarea dir="auto" className="input min-h-20" value={d.answer} onChange={(e) => set({ answer: e.target.value })} />
          </label>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {edit ? (
            <>
              <button className="btn-primary" disabled={busy} onClick={() => save("back")}>{busy ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</button>
              <Link href="/kurum/soru-havuzu" className="btn-secondary">Vazgeç</Link>
            </>
          ) : (
            <>
              <button className="btn-primary" disabled={busy} onClick={() => save("new")} title="Ctrl+Enter">{busy ? "Kaydediliyor…" : "Kaydet ve yenisini yaz"}</button>
              <button className="btn-secondary" disabled={busy} onClick={() => save("back")}>Kaydet ve havuza dön</button>
              <span className="text-xs text-lead">Ctrl+Enter ile de kaydedilir.</span>
            </>
          )}
        </div>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`} role="status">{msg.text}</p>}
      </section>

      <section className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <h2 className="mb-1.5 text-sm font-semibold">Kâğıtta böyle görünür</h2>
        <div className="rounded-lg bg-white p-4 text-black ring-1 ring-rule">
          {d.stem.trim() || imageSrc || (d.type === "MC" && d.options.some(Boolean)) ? (
            <div className="flex gap-1.5">
              <b className="shrink-0 text-[14px]">1.</b>
              <div className="min-w-0 flex-1">
                <QuestionView type={d.type} content={previewContent} imageSrc={imageSrc} answer={d.type === "MC" || d.type === "TF" ? d.answer : undefined} print />
              </div>
            </div>
          ) : (
            <p className="text-sm text-lead">Yazdıkça burada görünür.</p>
          )}
        </div>
        {!edit && (d.type === "OPEN" || d.type === "FILL") && <p className="mt-1.5 text-xs text-lead">{QUESTION_TYPES[d.type].label} sorular optikle okunamaz; çalışma kağıdında kullanılır.</p>}
        {saved.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1 flex items-center text-sm font-semibold">
              Bu oturumda eklenenler ({saved.length})
              <Link href="/kurum/soru-havuzu" className="ml-auto text-[13px] font-normal text-lead hover:text-graphite">Havuzda gör ›</Link>
            </h3>
            <ol className="divide-y divide-rule/70 text-[13px]">
              {saved.slice(0, 8).map((s, i) => (
                <li key={saved.length - i} className="flex gap-2 py-1">
                  <span className="badge shrink-0 bg-mist text-lead">{QUESTION_TYPES[s.type as QuestionType]?.short}</span>
                  <span dir="auto" className="min-w-0 truncate">{s.text}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ Yapıştır ve böl */

type Override = { type?: QuestionType; answer?: string; removed?: boolean };
/** Düzeltmeler soru köküne bağlanır; metnin başka yeri değişince kaybolmaz. */
const keyOf = (q: DraftQuestion, i: number) => `${i}:${q.stem.slice(0, 120)}`;

function PasteSplitter({ common }: { common: Common }) {
  const [text, setText] = useState("");
  const [over, setOver] = useState<Record<string, Override>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const parsed = useMemo(() => splitPasted(text), [text]);

  const drafts = parsed.map((q, i) => {
    const k = keyOf(q, i);
    const o = over[k] ?? {};
    const type = o.type ?? q.type;
    const answer = o.answer ?? (o.type && o.type !== q.type ? "" : q.answer);
    const missing = type === "FILL" ? !answer || splitFill(answer).length !== countBlanks(q.stem) : type !== "OPEN" && !answer;
    return { ...q, key: k, type, answer, missing, removed: !!o.removed, problem: blocking({ type, stem: q.stem, options: q.options }) };
  });
  const active = drafts.filter((d) => !d.removed);
  const bad = active.filter((d) => d.problem);
  const noAnswer = active.filter((d) => d.missing);
  const counts = TYPE_ORDER.map((t) => [t, active.filter((d) => d.type === t).length] as const).filter(([, n]) => n);
  const setO = (k: string, p: Override) => setOver((m) => ({ ...m, [k]: { ...m[k], ...p } }));

  async function saveAll() {
    if (!common.subject.trim()) return setMsg({ ok: false, text: "Önce dersi seçin." });
    if (!active.length) return setMsg({ ok: false, text: "Kaydedilecek soru yok." });
    if (bad.length) return setMsg({ ok: false, text: `${bad.length} soruda düzeltilmesi gereken sorun var; düzeltin ya da çıkarın.` });
    setBusy(true);
    setMsg(null);
    const metas: WrittenMeta[] = active.map((d) => {
      const blanks = countBlanks(d.stem);
      const fillOk = d.type === "FILL" && splitFill(d.answer).length === blanks;
      return { type: d.type, stem: d.stem, options: d.type === "MC" ? d.options : undefined, answer: d.type === "FILL" && !fillOk ? "" : d.answer, ...tagsOf(common) };
    });
    let done = 0;
    for (let i = 0; i < metas.length; i += LIMITS.batch) {
      const fd = new FormData();
      fd.set("meta", JSON.stringify(metas.slice(i, i + LIMITS.batch)));
      const res = await fetch(API_NEW, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        const err = String(json.error ?? "Kaydedilemedi.").replace(/^(\d+)\. soru/, (_, n) => `${Number(n) + i}. soru`);
        return setMsg({ ok: false, text: done ? `${done} soru kaydedildi; sonrakiler kaydedilemedi: ${err}` : err });
      }
      done += json.created ?? 0;
    }
    setBusy(false);
    setText("");
    setOver({});
    setMsg({ ok: true, text: `${done} soru havuza eklendi.` });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <span className="label mb-0">Soruları yapıştırın</span>
          <button type="button" className="ml-auto text-[13px] text-lead hover:text-graphite" onClick={() => { setText(PASTE_SAMPLE); setOver({}); }}>Örnek metinle dene</button>
        </div>
        <textarea
          dir="auto"
          className="input min-h-[55vh] resize-y font-mono text-[13px] leading-relaxed"
          value={text}
          onChange={(e) => { setText(e.target.value); setMsg(null); }}
          placeholder={"Word'den, PDF'ten ya da bir metinden kopyalayıp buraya yapıştırın.\n\n1. Soru kökü\nA) …  B) …  C) …  D) …\nCevap: B\n\n2. ( ) Doğru / yanlış yargısı\nCevap: Doğru\n\n3. Boşluklu cümle ___ gibi.\nCevap: kelime"}
        />
        <details className="mt-2 text-[13px] text-lead">
          <summary className="cursor-pointer">Hangi düzen tanınır?</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>Her soru numarayla başlar (1. 1) 1- “Soru 1:”). Numara yoksa boş satır soruları ayırır.</li>
            <li>Şıklar ayrı satırda ya da yan yana: A) … B) … — doğru şık önüne * konabilir (*C).</li>
            <li>Sorunun altında “Cevap: C” ya da en sonda “Cevap anahtarı: 1-C 2-A 3-D”.</li>
            <li>“( )” ile başlayan yargı ya da cevabı Doğru/Yanlış olan soru → doğru / yanlış.</li>
            <li>Kökte ___ ya da ..... varsa → boşluk doldurma; birden çok boşluğun cevabı virgülle.</li>
            <li>Bunlar yoksa → açık uçlu. Türü ve cevabı sağdaki listeden düzeltebilirsiniz.</li>
          </ul>
        </details>
      </section>

      <section className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <h2 className="text-sm font-semibold">{active.length ? `${active.length} soru bulundu` : "Önizleme"}</h2>
          {counts.map(([t, n]) => <span key={t} className="text-lead">{QUESTION_TYPES[t].label.toLocaleLowerCase("tr")} {n}</span>)}
          {noAnswer.length > 0 && <span className="text-amber-700">{noAnswer.length} sorunun cevabı eksik</span>}
          {bad.length > 0 && <span className="text-red-700">{bad.length} soruda sorun var</span>}
        </div>
        {!drafts.length ? (
          <p className="rounded-lg border border-dashed border-lead/40 px-4 py-10 text-center text-sm text-lead">Yapıştırdığınız sorular burada ayrı ayrı görünür.</p>
        ) : (
          <ol className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
            {drafts.map((d, i) => (
              <li key={d.key} className={`card px-3 py-2 ${d.removed ? "opacity-45" : d.problem ? "ring-1 ring-red-300" : ""}`}>
                <div className="mb-1 flex items-center gap-2 text-[13px]">
                  <b className="num">{d.no ?? i + 1}.</b>
                  <select className="input w-auto px-1.5 py-0.5 text-[13px]" value={d.type} disabled={d.removed} onChange={(e) => setO(d.key, { type: e.target.value as QuestionType, answer: undefined })} aria-label="Soru türü">
                    {TYPE_ORDER.map((t) => <option key={t} value={t}>{QUESTION_TYPES[t].label}</option>)}
                  </select>
                  {d.removed ? null : d.problem ? <span className="text-red-700">{d.problem}</span> : d.missing && <span className="text-amber-700">{d.type === "FILL" && d.answer ? "Her boşluğa bir cevap" : "Cevap eksik"}</span>}
                  <button type="button" className="ml-auto text-xs text-lead hover:text-graphite" onClick={() => setO(d.key, { removed: !d.removed })}>{d.removed ? "Geri al" : "Çıkar"}</button>
                </div>
                {!d.removed && (
                  <>
                    <QuestionView type={d.type} content={{ stem: d.stem, options: d.type === "MC" ? d.options : undefined }} answer={d.answer} />
                    <DraftAnswer d={d} onChange={(answer) => setO(d.key, { answer })} />
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={busy || !active.length} onClick={saveAll}>{busy ? "Kaydediliyor…" : `${active.length || ""} soruyu havuza kaydet`.trim()}</button>
          {msg?.ok && <Link href="/kurum/soru-havuzu" className="text-[13px] text-lead hover:text-graphite">Havuzda gör ›</Link>}
        </div>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`} role="status">{msg.text}</p>}
        <p className="mt-2 text-xs text-lead">Şekilli soruları kaydettikten sonra havuzda “Düzenle” ile görsel ekleyebilirsiniz.</p>
      </section>
    </div>
  );
}

/** Bölünen sorunun cevabını türüne göre düzeltme. */
function DraftAnswer({ d, onChange }: { d: { type: QuestionType; answer: string; options: string[]; stem: string }; onChange: (a: string) => void }) {
  const pill = (on: boolean) => `size-6 rounded-full border text-[11px] font-semibold ${on ? "border-emerald-700 bg-emerald-700 text-white" : "border-ink/40 text-lead hover:border-graphite"}`;
  if (d.type === "MC")
    return (
      <div className="mt-1.5 flex items-center gap-1 text-xs text-lead">
        Cevap:
        {d.options.map((_, i) => {
          const l = OPTION_LETTERS[i];
          return <button key={l} type="button" aria-pressed={d.answer === l} className={pill(d.answer === l)} onClick={() => onChange(d.answer === l ? "" : l)}>{l}</button>;
        })}
      </div>
    );
  if (d.type === "TF")
    return (
      <div className="mt-1.5 flex items-center gap-1 text-xs text-lead">
        Cevap:
        {(["D", "Y"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={d.answer === v} className={`rounded-md border px-2 py-0.5 font-semibold ${d.answer === v ? "border-emerald-700 bg-emerald-700 text-white" : "border-ink/40"}`} onClick={() => onChange(d.answer === v ? "" : v)}>
            {answerLabel("TF", v)}
          </button>
        ))}
      </div>
    );
  if (d.type === "FILL") {
    const n = countBlanks(d.stem);
    return (
      <label className="mt-1.5 flex items-center gap-2 text-xs text-lead">
        <span className="shrink-0">Cevap{n > 1 ? `lar (${n}, virgülle)` : ""}:</span>
        <input dir="auto" className="input py-0.5 text-[13px]" value={splitFill(d.answer).join(", ")} onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).join(" | "))} />
      </label>
    );
  }
  return d.answer ? <p dir="auto" className="mt-1.5 text-xs text-lead">Örnek cevap: {d.answer}</p> : null;
}
