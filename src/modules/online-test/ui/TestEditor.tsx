"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { QUESTION_TYPES } from "../grading";

type EOption = { id?: string; key: string; text: string; isCorrect: boolean };
type EQuestion = {
  id?: string;
  key: string;
  type: string;
  text: string;
  points: number;
  correctText: string;
  explanation: string;
  options: EOption[];
};
export type EditorTest = {
  id: string;
  title: string;
  description: string;
  shareCode: string;
  timeLimitMin: number | "";
  passPercent: number;
  shuffleQuestions: boolean;
  showAnswers: boolean;
  isPublished: boolean;
  questions: EQuestion[];
};

let seq = 0;
const k = () => `new-${Date.now()}-${seq++}`;
const blankOptions = (n: number): EOption[] =>
  Array.from({ length: n }, (_, i) => ({ key: k(), text: "", isCorrect: i === 0 }));

export default function TestEditor({ initial }: { initial: EditorTest }) {
  const router = useRouter();
  const [t, setT] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  const update = (patch: Partial<EditorTest>) => {
    setT((s) => ({ ...s, ...patch }));
    setStatus("idle");
  };
  const updateQ = (i: number, patch: Partial<EQuestion>) =>
    update({ questions: t.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  function changeType(i: number, type: string) {
    const q = t.questions[i];
    let options = q.options;
    if (type === "TRUE_FALSE") {
      options = [
        { key: k(), text: "Doğru", isCorrect: true },
        { key: k(), text: "Yanlış", isCorrect: false },
      ];
    } else if (q.type === "TRUE_FALSE" && (type === "SINGLE" || type === "MULTI")) {
      options = blankOptions(4);
    } else if (type === "SINGLE") {
      const first = options.findIndex((o) => o.isCorrect);
      options = options.map((o, j) => ({ ...o, isCorrect: j === Math.max(0, first) }));
    }
    updateQ(i, { type, options });
  }

  function setCorrect(i: number, oi: number) {
    const q = t.questions[i];
    const options = q.options.map((o, j) =>
      q.type === "MULTI" ? (j === oi ? { ...o, isCorrect: !o.isCorrect } : o) : { ...o, isCorrect: j === oi },
    );
    updateQ(i, { options });
  }

  function move(i: number, d: number) {
    const qs = [...t.questions];
    const j = i + d;
    if (j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    update({ questions: qs });
  }

  function validate(): string | null {
    if (!t.title.trim()) return "Sınav başlığı boş olamaz.";
    for (const [i, q] of t.questions.entries()) {
      if (!q.text.trim()) return `${i + 1}. sorunun metni boş.`;
      if (q.type === "SHORT") {
        if (!q.correctText.trim()) return `${i + 1}. soru için kabul edilen cevap girin.`;
      } else {
        if (q.options.length < 2) return `${i + 1}. soruda en az 2 seçenek olmalı.`;
        if (q.options.some((o) => !o.text.trim())) return `${i + 1}. soruda boş seçenek var.`;
        if (!q.options.some((o) => o.isCorrect)) return `${i + 1}. soruda doğru cevap işaretlenmemiş.`;
      }
    }
    return null;
  }

  async function save() {
    const v = validate();
    if (v) {
      setError(v);
      setStatus("error");
      return;
    }
    setError("");
    setStatus("saving");
    const res = await fetch(`/api/tests/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t),
    });
    if (!res.ok) {
      setStatus("error");
      setError("Kaydedilemedi.");
      return;
    }
    const { questions } = (await res.json()) as { questions: { id: string; options: { id: string }[] }[] };
    setT((s) => ({
      ...s,
      questions: s.questions.map((q, i) => ({
        ...q,
        id: questions[i]?.id,
        options: q.type === "SHORT" ? [] : q.options.map((o, j) => ({ ...o, id: questions[i]?.options[j]?.id })),
      })),
    }));
    setStatus("saved");
    router.refresh();
  }

  async function remove() {
    if (!confirm("Bu sınav ve tüm sonuçları kalıcı olarak silinsin mi?")) return;
    await fetch(`/api/tests/${t.id}`, { method: "DELETE" });
    router.push("/panel");
    router.refresh();
  }

  const totalPoints = t.questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/s/${t.shareCode}` : `/s/${t.shareCode}`;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="card space-y-4 p-5">
          <div>
            <label className="label">Sınav başlığı</label>
            <input className="input text-base font-semibold" value={t.title} onChange={(e) => update({ title: e.target.value })} />
          </div>
          <div>
            <label className="label">Açıklama / Yönerge</label>
            <textarea className="input" rows={2} value={t.description} onChange={(e) => update({ description: e.target.value })} />
          </div>
        </div>

        {t.questions.map((q, i) => (
          <div key={q.key} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
              <select className="input w-auto" value={q.type} onChange={(e) => changeType(i, e.target.value)}>
                {Object.entries(QUESTION_TYPES).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-sm text-slate-600">
                Puan
                <input type="number" min={1} className="input w-16" value={q.points} onChange={(e) => updateQ(i, { points: Number(e.target.value) })} />
              </label>
              <div className="ml-auto flex gap-1">
                <IconBtn title="Yukarı" onClick={() => move(i, -1)}>↑</IconBtn>
                <IconBtn title="Aşağı" onClick={() => move(i, 1)}>↓</IconBtn>
                <IconBtn
                  title="Kopyala"
                  onClick={() => {
                    const copy: EQuestion = { ...q, id: undefined, key: k(), options: q.options.map((o) => ({ ...o, id: undefined, key: k() })) };
                    const qs = [...t.questions];
                    qs.splice(i + 1, 0, copy);
                    update({ questions: qs });
                  }}
                >⧉</IconBtn>
                <IconBtn title="Sil" onClick={() => update({ questions: t.questions.filter((_, j) => j !== i) })}>✕</IconBtn>
              </div>
            </div>
            <textarea
              className="input mt-3"
              rows={2}
              placeholder="Soru metnini yazın…"
              value={q.text}
              onChange={(e) => updateQ(i, { text: e.target.value })}
            />

            {q.type === "SHORT" ? (
              <div className="mt-3">
                <label className="label">Kabul edilen cevap(lar)</label>
                <input
                  className="input"
                  placeholder="Ankara|ankara şehri  (alternatifleri | ile ayırın)"
                  value={q.correctText}
                  onChange={(e) => updateQ(i, { correctText: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-500">Büyük/küçük harf ve fazla boşluklar dikkate alınmaz.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-slate-500">
                  {q.type === "MULTI" ? "Doğru olan tüm seçenekleri işaretleyin." : "Doğru seçeneği işaretleyin."}
                </p>
                {q.options.map((o, oi) => (
                  <div key={o.key} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrect(i, oi)}
                      title="Doğru cevap"
                      className={`grid h-8 w-8 shrink-0 place-items-center ${q.type === "MULTI" ? "rounded-md" : "rounded-full"} border-2 text-sm font-bold ${o.isCorrect ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-slate-400"}`}
                    >
                      {o.isCorrect ? "✓" : "ABCDEFGH"[oi]}
                    </button>
                    <input
                      className="input"
                      value={o.text}
                      disabled={q.type === "TRUE_FALSE"}
                      placeholder={`Seçenek ${"ABCDEFGH"[oi]}`}
                      onChange={(e) => updateQ(i, { options: q.options.map((x, j) => (j === oi ? { ...x, text: e.target.value } : x)) })}
                    />
                    {q.type !== "TRUE_FALSE" && q.options.length > 2 && (
                      <IconBtn
                        title="Seçeneği sil"
                        onClick={() => {
                          const options = q.options.filter((_, j) => j !== oi);
                          if (!options.some((x) => x.isCorrect)) options[0] = { ...options[0], isCorrect: true };
                          updateQ(i, { options });
                        }}
                      >✕</IconBtn>
                    )}
                  </div>
                ))}
                {q.type !== "TRUE_FALSE" && q.options.length < 8 && (
                  <button className="text-sm font-medium text-brand-600" onClick={() => updateQ(i, { options: [...q.options, { key: k(), text: "", isCorrect: false }] })}>
                    + Seçenek ekle
                  </button>
                )}
                {q.type === "SINGLE" && q.options.length > 5 && (
                  <p className="text-xs text-amber-600">Optik formda yalnızca ilk 5 seçenek (A–E) kullanılabilir.</p>
                )}
              </div>
            )}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-slate-500">Açıklama (sonuç ekranında gösterilir)</summary>
              <textarea className="input mt-2" rows={2} value={q.explanation} onChange={(e) => updateQ(i, { explanation: e.target.value })} />
            </details>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          {Object.entries(QUESTION_TYPES).map(([type, label]) => (
            <button
              key={type}
              className="btn-secondary"
              onClick={() =>
                update({
                  questions: [
                    ...t.questions,
                    {
                      key: k(),
                      type,
                      text: "",
                      points: 1,
                      correctText: "",
                      explanation: "",
                      options:
                        type === "TRUE_FALSE"
                          ? [
                              { key: k(), text: "Doğru", isCorrect: true },
                              { key: k(), text: "Yanlış", isCorrect: false },
                            ]
                          : type === "SHORT"
                            ? []
                            : blankOptions(4),
                    },
                  ],
                })
              }
            >
              + {label}
            </button>
          ))}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card space-y-4 p-5">
          <h2 className="font-semibold">Ayarlar</h2>
          <Toggle label="Yayında (katılıma açık)" checked={t.isPublished} onChange={(v) => update({ isPublished: v })} />
          <Toggle label="Soruları karıştır" checked={t.shuffleQuestions} onChange={(v) => update({ shuffleQuestions: v })} />
          <Toggle label="Sonuçta doğru cevapları göster" checked={t.showAnswers} onChange={(v) => update({ showAnswers: v })} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Süre (dk)</label>
              <input
                type="number"
                min={1}
                className="input"
                placeholder="Sınırsız"
                value={t.timeLimitMin}
                onChange={(e) => update({ timeLimitMin: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Geçme notu %</label>
              <input type="number" min={0} max={100} className="input" value={t.passPercent} onChange={(e) => update({ passPercent: Number(e.target.value) })} />
            </div>
          </div>
          <p className="text-sm text-slate-500">
            {t.questions.length} soru · toplam {totalPoints} puan
          </p>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" onClick={save} disabled={status === "saving"}>
            {status === "saving" ? "Kaydediliyor…" : status === "saved" ? "Kaydedildi ✓" : "Kaydet"}
          </button>
        </div>
        <div className="card space-y-2 p-5">
          <h2 className="font-semibold">Paylaş</h2>
          <input className="input font-mono text-xs" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
          <button className="btn-secondary w-full" onClick={() => navigator.clipboard.writeText(shareUrl)}>Bağlantıyı kopyala</button>
          {!t.isPublished && <p className="text-xs text-amber-600">Sınav taslakta. Katılımcıların girebilmesi için yayına alıp kaydedin.</p>}
        </div>
        <button className="btn-danger w-full" onClick={remove}>Sınavı sil</button>
      </aside>
    </div>
  );
}

function IconBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800" {...p}>
      {children}
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      {label}
      <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
