"use client";
/** Başarı Skoru ağırlık ve eşikleri: kaydırıcılar, canlı dağılım önizlemesi, kaydet / varsayılana dön. */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_SCORE_SETTINGS,
  DIM_KEYS,
  LEVELS,
  levelOf,
  SCORE_DIMS,
  totalScore,
  type ScoreDim,
  type ScoreLevel,
  type ScoreSettings,
} from "@/modules/reporting";

type Props = { initial: ScoreSettings; dims: Record<ScoreDim, number | null>[] };

export default function ScoreSettingsForm({ initial, dims }: Props) {
  const router = useRouter();
  const [s, setS] = useState<ScoreSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const counts = useMemo(() => {
    const c = { GOOD: 0, WATCH: 0, RISK: 0 } as Record<ScoreLevel, number>;
    for (const d of dims) {
      const lv = levelOf(totalScore(d, s), s);
      if (lv) c[lv]++;
    }
    return c;
  }, [dims, s]);
  const weightSum = DIM_KEYS.reduce((a, k) => a + s.weights[k], 0);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);

  async function save(settings: ScoreSettings | null) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/kurum/ayarlar/skor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg((await res.json().catch(() => null))?.error ?? "Kaydedilemedi.");
      return;
    }
    const out = (await res.json()) as { settings: ScoreSettings };
    setS(out.settings);
    setMsg("Kaydedildi.");
    router.refresh();
  }

  const setWeight = (k: ScoreDim, v: number) => setS((x) => ({ ...x, weights: { ...x.weights, [k]: v } }));

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div>
        <h3 className="mb-2 text-[15px] font-semibold">Ağırlıklar</h3>
        <div className="space-y-2.5">
          {DIM_KEYS.map((k) => (
            <label key={k} className="grid grid-cols-[8.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
              <span title={SCORE_DIMS[k].hint}>{SCORE_DIMS[k].label}</span>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={s.weights[k]}
                onChange={(e) => setWeight(k, Number(e.target.value))}
                className="accent-graphite"
              />
              <span className="num text-right text-lead">%{weightSum ? Math.round((s.weights[k] / weightSum) * 100) : 0}</span>
            </label>
          ))}
        </div>
        <h3 className="mt-5 mb-2 text-[15px] font-semibold">Seviye eşikleri</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            İyi: en az
            <input
              type="number"
              min={1}
              max={100}
              value={s.good}
              onChange={(e) => setS((x) => ({ ...x, good: Number(e.target.value) }))}
              className="input w-20"
            />
          </label>
          <label className="flex items-center gap-2">
            İzlenmeli: en az
            <input
              type="number"
              min={0}
              max={99}
              value={s.watch}
              onChange={(e) => setS((x) => ({ ...x, watch: Number(e.target.value) }))}
              className="input w-20"
            />
          </label>
        </div>
        {s.watch >= s.good && <p className="mt-1 text-xs text-red-700">“İzlenmeli” eşiği “İyi” eşiğinden küçük olmalı.</p>}
      </div>

      <div>
        <h3 className="mb-2 text-[15px] font-semibold">Bu ayarlarla</h3>
        <ul className="divide-y divide-rule/70 border-y border-rule/70 text-sm">
          {(Object.keys(LEVELS) as ScoreLevel[]).map((lv) => (
            <li key={lv} className="flex justify-between py-1.5">
              <span className={`badge ${LEVELS[lv].cls}`}>{LEVELS[lv].label}</span>
              <span className="num font-semibold">{counts[lv]} öğrenci</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={busy || !dirty || s.watch >= s.good || weightSum === 0} onClick={() => save(s)}>
            Ayarları kaydet
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => setS(DEFAULT_SCORE_SETTINGS)}>
            Varsayılan değerler
          </button>
          {msg && <span className="text-sm text-lead">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
