/** Öğrenci profilindeki Başarı Skoru kartı: toplam, değişim, beş boyutun ayrıntısı ve açıklamalar. */
import Link from "next/link";
import { DIM_KEYS, dimDetail, LEVELS, SCORE_DIMS, SCORE_RULES, type ScoreSettings } from "../../score";
import type { SuccessScoreRow } from "../../internal/score";
import { barColor, ScoreDelta } from "./ScoreParts";

export default function ScoreCard({ s }: { s: SuccessScoreRow & { settings: ScoreSettings } }) {
  const totalW = DIM_KEYS.reduce((a, k) => a + (s.dims[k] === null ? 0 : s.settings.weights[k]), 0);
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Başarı Skoru</h2>
        <Link href="/kurum/analiz?tab=skor" className="no-print text-xs text-lead hover:text-graphite">Bütün öğrenciler</Link>
      </div>
      {s.score === null || s.level === null ? (
        <p className="mt-2 text-sm text-lead">Skor hesaplamak için henüz deneme, yoklama ya da ödev verisi yok.</p>
      ) : (
        <div className="mt-3 grid gap-5 md:grid-cols-[11rem_minmax(0,1fr)]">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="num font-display text-[2.6rem] leading-none font-semibold [font-stretch:85%]">{s.score}</span>
              <ScoreDelta delta={s.delta} />
            </div>
            <span className={`badge mt-2 ${LEVELS[s.level].cls}`}>{LEVELS[s.level].label}</span>
            <p className="mt-2 text-xs text-lead">
              {s.prevScore === null ? `${SCORE_RULES.trendDays} gün önce yeterli veri yoktu.` : `${SCORE_RULES.trendDays} gün önce ${s.prevScore}.`}
            </p>
            {s.reasons.length > 0 && (
              <ul className="mt-3 space-y-1 text-[13px]">
                {s.reasons.map((r) => (
                  <li key={r} className="border-l-2 border-red-300 pl-2">{r}</li>
                ))}
              </ul>
            )}
          </div>
          <ul className="space-y-2">
            {DIM_KEYS.map((k) => {
              const v = s.dims[k];
              const share = v === null || !totalW ? null : Math.round((s.settings.weights[k] / totalW) * 100);
              return (
                <li key={k} className="grid grid-cols-[7.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
                  <span>
                    {SCORE_DIMS[k].label}
                    <span className="block text-[11px] text-lead">{share === null ? "hesaba katılmadı" : `ağırlık %${share}`}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block h-2 overflow-hidden rounded-sm bg-mist">
                      {v !== null && <span className={`block h-full ${barColor(v)}`} style={{ width: `${Math.max(3, v)}%` }} />}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-lead" title={dimDetail(k, s.signals)}>{dimDetail(k, s.signals)}</span>
                  </span>
                  <span className="num text-right font-semibold">{v ?? "—"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
