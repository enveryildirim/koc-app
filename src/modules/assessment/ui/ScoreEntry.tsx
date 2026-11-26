"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtPercent, percentTone, quickValues, type Criterion } from "../index";

type Score = { scores: number[]; total: number | null; percent: number | null; note: string; absent: boolean };
type Row = { id: string; no: string; name: string; guest: string | null; score: Score | null };

/**
 * Telefonda puan girişi: öğrenciye dokun → her kriter için hızlı düğmeler (ya da sayı) → "Kaydet ve sonraki".
 * Kaydedince sıradaki puansız öğrenci açılır. Gelmedi ve not da girilebilir.
 */
export default function ScoreEntry({ assessmentId, criteria, maxTotal, students }: { assessmentId: string; criteria: Criterion[]; maxTotal: number; students: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(students);
  const [open, setOpen] = useState<string | null>(() => students.find((s) => !s.score)?.id ?? null);
  const [draft, setDraft] = useState<{ scores: (number | null)[]; note: string }>(() => fresh(students.find((s) => !s.score) ?? null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function fresh(r: Row | null) {
    const s = r?.score;
    return { scores: criteria.map((_, i) => (s && !s.absent ? (s.scores[i] ?? null) : null)), note: s?.note ?? "" };
  }

  const done = rows.filter((r) => r.score).length;
  const avg = useMemo(() => {
    const p = rows.map((r) => r.score).filter((s): s is Score => !!s && !s.absent && s.percent !== null).map((s) => s.percent!);
    return p.length ? p.reduce((a, b) => a + b, 0) / p.length : null;
  }, [rows]);

  function toggle(r: Row) {
    setError("");
    if (open === r.id) return setOpen(null);
    setOpen(r.id);
    setDraft(fresh(r));
  }

  async function save(r: Row, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/kurum/degerlendirme/${assessmentId}/puan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: r.id, ...body }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(j.error ?? "Kaydedilemedi.");
    const score: Score | null = body.clear
      ? null
      : { scores: (body.scores as number[]) ?? [], total: j.total ?? null, percent: j.percent ?? null, note: String(body.note ?? ""), absent: !!body.absent };
    const next = rows.map((x) => (x.id === r.id ? { ...x, score } : x));
    setRows(next);
    // Sıradaki puansız öğrenci (listede bu öğrenciden sonra, yoksa baştan)
    const i = next.findIndex((x) => x.id === r.id);
    const after = [...next.slice(i + 1), ...next.slice(0, i)].find((x) => !x.score);
    setOpen(body.clear ? r.id : (after?.id ?? null));
    setDraft(fresh(body.clear ? { ...r, score: null } : (after ?? null)));
    router.refresh();
  }

  const complete = draft.scores.every((v) => v !== null);
  const draftTotal = draft.scores.reduce<number>((s, v) => s + (v ?? 0), 0);

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 border-b border-rule/70 px-3.5 py-2.5">
        <h2 className="font-semibold">Puanlar</h2>
        <span className="text-[13px] text-lead">
          <span className="num font-semibold text-graphite">{done}</span>/{rows.length} girildi
          {avg !== null && <> · ort. <span className={`num font-semibold ${percentTone(avg)}`}>{fmtPercent(avg)}</span></>}
        </span>
      </div>
      <ul className="divide-y divide-rule/70">
        {rows.map((r) => (
          <li key={r.id} className={open === r.id ? "bg-paper/70" : ""}>
            <button className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-paper" onClick={() => toggle(r)}>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{r.name}</span>
                <span className="text-[12.5px] text-lead">
                  <span className="num">{r.no}</span>
                  {r.guest && <span> · {r.guest}</span>}
                  {r.score?.note && <span> · {r.score.note}</span>}
                </span>
              </span>
              {r.score ? (
                r.score.absent ? (
                  <span className="badge bg-zinc-100 text-zinc-600">Gelmedi</span>
                ) : (
                  <span className={`num text-lg font-semibold ${percentTone(r.score.percent)}`}>
                    {r.score.total}
                    <span className="text-[12px] font-normal text-lead">/{maxTotal}</span>
                  </span>
                )
              ) : (
                <span className="text-[13px] text-lead">Gir ›</span>
              )}
            </button>
            {open === r.id && (
              <div className="space-y-3 px-3.5 pb-3.5">
                {criteria.map((c, i) => (
                  <div key={c.name}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-[12.5px] text-lead">en çok {c.max}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {quickValues(c.max).map((v) => (
                        <button
                          key={v}
                          onClick={() => setDraft((d) => ({ ...d, scores: d.scores.map((x, j) => (j === i ? v : x)) }))}
                          className={`num min-w-11 rounded-md px-2 py-2 text-sm font-semibold ${draft.scores[i] === v ? "bg-graphite text-surface" : "bg-surface ring-1 ring-rule"}`}
                        >
                          {v}
                        </button>
                      ))}
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={c.max}
                        aria-label={`${c.name} puanı`}
                        className="input num w-16 py-2 text-center"
                        value={draft.scores[i] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? null : Math.max(0, Math.min(c.max, Number(e.target.value)));
                          setDraft((d) => ({ ...d, scores: d.scores.map((x, j) => (j === i ? v : x)) }));
                        }}
                      />
                    </div>
                  </div>
                ))}
                <input className="input" placeholder="Not (isteğe bağlı)" value={draft.note} maxLength={300} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn-primary px-4 py-2.5" disabled={busy || !complete} onClick={() => save(r, { scores: draft.scores, note: draft.note })}>
                    Kaydet ve sonraki{complete && <span className="num font-normal opacity-80"> · {draftTotal}/{maxTotal}</span>}
                  </button>
                  <button className="btn-secondary py-2.5" disabled={busy} onClick={() => save(r, { absent: true, note: draft.note })}>Gelmedi</button>
                  {r.score && (
                    <button className="ml-auto text-sm text-lead/70 hover:text-red-600" disabled={busy} onClick={() => save(r, { clear: true })}>Puanı sil</button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="p-6 text-center text-sm text-lead">Bu sınıfta öğrenci yok.</li>}
      </ul>
    </section>
  );
}
