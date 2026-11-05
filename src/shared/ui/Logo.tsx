/** SınavKur işareti: optik formdaki bir cevap satırı, işaretlenmiş şık dolu. */
export function AnswerRow({ marked = 2, size = 10, className = "" }: { marked?: number; size?: number; className?: string }) {
  const gap = size * 0.45;
  const w = 5 * size + 4 * gap;
  return (
    <svg width={w} height={size} viewBox={`0 0 ${w} ${size}`} aria-hidden="true" className={className}>
      {Array.from({ length: 5 }, (_, i) => (
        <circle
          key={i}
          cx={size / 2 + i * (size + gap)}
          cy={size / 2}
          r={size / 2 - 0.75}
          fill={i === marked ? "currentColor" : "none"}
          stroke={i === marked ? "currentColor" : "var(--color-ink)"}
          strokeWidth={1.25}
        />
      ))}
    </svg>
  );
}

export default function Logo({ sub }: { sub?: string }) {
  return (
    <span className="flex flex-col gap-1">
      <AnswerRow />
      <span className="font-display text-[1.2rem] leading-none font-semibold [font-stretch:80%]">SınavKur</span>
      {sub && <span className="truncate text-[13px] leading-snug text-lead">{sub}</span>}
    </span>
  );
}
