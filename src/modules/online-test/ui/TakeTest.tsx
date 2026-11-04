"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type PublicTest = {
  code: string;
  title: string;
  description: string;
  timeLimitMin: number | null;
  questions: { id: string; type: string; text: string; points: number; options: { id: string; text: string }[] }[];
};

type Ans = { optionIds?: string[]; text?: string };

export default function TakeTest({ test }: { test: PublicTest }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, Ans>>({});
  const [current, setCurrent] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const submit = useCallback(async () => {
    setBusy(true);
    const res = await fetch(`/api/t/${test.code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, studentNo, answers: answersRef.current, startedAt }),
    });
    const json = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(json.error ?? "Gönderilemedi.");
      return;
    }
    router.push(`/sonuc/${json.id}`);
  }, [name, studentNo, startedAt, test.code, router]);

  useEffect(() => {
    if (!startedAt || !test.timeLimitMin) return;
    const end = startedAt + test.timeLimitMin * 60000;
    const tick = () => {
      const l = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) submit();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);

  if (!startedAt) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="card p-8">
          <h1 className="text-2xl font-bold">{test.title}</h1>
          {test.description && <p className="mt-2 whitespace-pre-line text-lead">{test.description}</p>}
          <div className="mt-4 flex gap-4 text-sm text-lead">
            <span>📝 {test.questions.length} soru</span>
            <span>⏱️ {test.timeLimitMin ? `${test.timeLimitMin} dakika` : "Süre sınırı yok"}</span>
          </div>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) setStartedAt(Date.now());
            }}
          >
            <div>
              <label className="label">Ad Soyad *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="label">Öğrenci no (isteğe bağlı)</label>
              <input className="input" value={studentNo} onChange={(e) => setStudentNo(e.target.value)} />
            </div>
            <button className="btn-primary w-full py-3">Sınava başla</button>
          </form>
        </div>
      </div>
    );
  }

  const q = test.questions[current];
  const a = answers[q.id] ?? {};
  const answered = test.questions.filter((x) => {
    const v = answers[x.id];
    return v && ((v.optionIds?.length ?? 0) > 0 || !!v.text?.trim());
  }).length;
  const setA = (v: Ans) => setAnswers((s) => ({ ...s, [q.id]: v }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-lead">
          <span className="font-semibold text-graphite">{test.title}</span> · {answered}/{test.questions.length} cevaplandı
        </div>
        {left !== null && (
          <div className={`rounded-lg px-3 py-1 font-mono text-lg font-bold ${left < 60 ? "bg-red-100 text-red-700" : "bg-graphite text-white"}`}>
            {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
          </div>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${((current + 1) / test.questions.length) * 100}%` }} />
      </div>

      <div className="card mt-6 p-6">
        <div className="flex justify-between text-sm text-lead">
          <span>Soru {current + 1} / {test.questions.length}</span>
          <span>{q.points} puan</span>
        </div>
        <h2 className="mt-2 whitespace-pre-line text-xl font-semibold">{q.text}</h2>
        {q.type === "MULTI" && <p className="mt-1 text-sm text-lead">Birden fazla seçenek işaretleyebilirsiniz.</p>}

        <div className="mt-5 space-y-2">
          {q.type === "SHORT" ? (
            <input className="input py-3 text-base" placeholder="Cevabınızı yazın" value={a.text ?? ""} onChange={(e) => setA({ text: e.target.value })} />
          ) : (
            q.options.map((o, i) => {
              const sel = a.optionIds?.includes(o.id) ?? false;
              return (
                <button
                  key={o.id}
                  onClick={() => {
                    if (q.type === "MULTI") {
                      const cur = new Set(a.optionIds ?? []);
                      if (cur.has(o.id)) cur.delete(o.id);
                      else cur.add(o.id);
                      setA({ optionIds: [...cur] });
                    } else setA({ optionIds: [o.id] });
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${sel ? "border-brand-500 bg-brand-50" : "border-rule hover:border-rule hover:bg-paper"}`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center ${q.type === "MULTI" ? "rounded-md" : "rounded-full"} text-xs font-bold ${sel ? "bg-brand-600 text-white" : "bg-mist text-lead"}`}
                  >
                    {"ABCDEFGH"[i]}
                  </span>
                  {o.text}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button className="btn-secondary" disabled={current === 0} onClick={() => setCurrent(current - 1)}>← Önceki</button>
        {current < test.questions.length - 1 ? (
          <button className="btn-primary" onClick={() => setCurrent(current + 1)}>Sonraki</button>
        ) : (
          <button
            className="btn-primary bg-emerald-600 hover:bg-emerald-700"
            disabled={busy}
            onClick={() => {
              const empty = test.questions.length - answered;
              if (empty > 0 && !confirm(`${empty} soru boş. Yine de bitirmek istiyor musunuz?`)) return;
              submit();
            }}
          >
            {busy ? "Gönderiliyor…" : "Sınavı bitir"}
          </button>
        )}
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-8 flex flex-wrap gap-2">
        {test.questions.map((x, i) => {
          const v = answers[x.id];
          const done = v && ((v.optionIds?.length ?? 0) > 0 || !!v.text?.trim());
          return (
            <button
              key={x.id}
              onClick={() => setCurrent(i)}
              className={`h-9 w-9 rounded-lg text-sm font-semibold ${i === current ? "ring-2 ring-brand-500" : ""} ${done ? "bg-brand-600 text-white" : "bg-white text-lead ring-1 ring-rule"}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
