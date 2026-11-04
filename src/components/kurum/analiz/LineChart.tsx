/** Bağımlılıksız SVG çizgi grafik (sunucu bileşeni). Eksik değerler çizgide boşluk bırakır. */

export const SERIES_COLORS = ["#2563eb", "#059669", "#d97706", "#db2777", "#7c3aed", "#0891b2", "#65a30d", "#dc2626"];

export type Series = { name: string; values: (number | null)[]; color?: string; dashed?: boolean };

export default function LineChart({
  labels,
  series,
  max,
  height = 260,
  unit = "",
}: {
  labels: string[];
  series: Series[];
  max?: number;
  height?: number;
  unit?: string;
}) {
  const W = 760;
  const H = height;
  const pad = { l: 44, r: 16, t: 14, b: 46 };
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (!all.length || labels.length === 0) return null;
  const lo = Math.max(0, Math.floor((Math.min(...all) * 0.9) / 5) * 5);
  const hi = Math.min(max ?? Infinity, Math.ceil((Math.max(...all) * 1.05) / 5) * 5) || 1;
  const span = Math.max(1, hi - lo);
  const x = (i: number) => pad.l + (labels.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (labels.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / span) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + (span * i) / 4);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gelişim grafiği">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#64748b">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - pad.b + 18}
            // Kenardaki etiketler grafiğin dışına taşmasın
            textAnchor={labels.length > 1 && i === 0 ? "start" : labels.length > 1 && i === labels.length - 1 ? "end" : "middle"}
            fontSize={11}
            fill="#475569"
          >
            {l.length > 18 ? l.slice(0, 17) + "…" : l}
          </text>
        ))}
        {series.map((s, si) => {
          const color = s.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
          // Eksik değerlerde çizgiyi böl
          const segs: string[][] = [[]];
          s.values.forEach((v, i) => {
            if (v === null) segs.push([]);
            else segs[segs.length - 1].push(`${x(i)},${y(v)}`);
          });
          return (
            <g key={s.name}>
              {segs
                .filter((p) => p.length > 1)
                .map((p, k) => (
                  <polyline key={k} points={p.join(" ")} fill="none" stroke={color} strokeWidth={s.dashed ? 2 : 2.5} strokeDasharray={s.dashed ? "6 4" : undefined} />
                ))}
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle key={i} cx={x(i)} cy={y(v)} r={s.dashed ? 3 : 4} fill={color}>
                    <title>{`${s.name} · ${labels[i]}: ${v.toLocaleString("tr-TR")}${unit}`}</title>
                  </circle>
                ),
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-600">
        {series.map((s, si) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <i
              className="inline-block h-0.5 w-5"
              style={{ background: s.color ?? SERIES_COLORS[si % SERIES_COLORS.length], borderTop: s.dashed ? "2px dashed" : undefined }}
            />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
