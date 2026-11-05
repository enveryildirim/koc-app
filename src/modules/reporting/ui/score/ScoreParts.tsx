/** Başarı Skoru gösterim parçaları (sunucu ve istemci bileşenlerinde kullanılabilir). */
import { DIM_KEYS, LEVELS, SCORE_DIMS, type ScoreDim, type ScoreLevel } from "../../score";

export const barColor = (v: number) => (v < 50 ? "bg-red-400" : v < 70 ? "bg-amber-400" : "bg-emerald-500");

/** Skor rozeti: "42 · Risk altında". */
export function ScoreBadge({ score, level, compact }: { score: number | null; level: ScoreLevel | null; compact?: boolean }) {
  if (score === null || level === null) return <span className="text-xs text-lead">Veri yok</span>;
  return (
    <span className={`badge num ${LEVELS[level].cls}`}>
      {score}
      {!compact && <span className="font-normal">· {LEVELS[level].label}</span>}
    </span>
  );
}

/** 4 hafta öncesine göre değişim. */
export function ScoreDelta({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-xs text-lead/70">—</span>;
  if (delta === 0) return <span className="num text-xs text-lead">=</span>;
  return (
    <span className={`num text-xs font-semibold ${delta > 0 ? "text-emerald-700" : "text-red-600"}`}>
      {delta > 0 ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

/** Beş boyutun küçük çubukları (tablo satırı için). */
export function DimBars({ dims, details }: { dims: Record<ScoreDim, number | null>; details?: Partial<Record<ScoreDim, string>> }) {
  return (
    <div className="grid w-[15rem] grid-cols-5 gap-1.5">
      {DIM_KEYS.map((k) => {
        const v = dims[k];
        return (
          <div key={k} title={`${SCORE_DIMS[k].label}: ${v === null ? "veri yok" : v}${details?.[k] ? ` — ${details[k]}` : ""}`}>
            <div className="text-[10px] leading-tight text-lead">{SCORE_DIMS[k].short}</div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-sm bg-mist">
              {v !== null && <div className={`h-full ${barColor(v)}`} style={{ width: `${Math.max(4, v)}%` }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
