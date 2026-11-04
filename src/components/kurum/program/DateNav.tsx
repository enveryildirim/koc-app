"use client";
import { useRouter } from "next/navigation";

/** Tarih seçici: önceki/sonraki gün, bugün ve takvim girişi. */
export default function DateNav({ date, today, base }: { date: string; today: string; base: string }) {
  const router = useRouter();
  const go = (d: string) => router.push(`${base}?tarih=${d}`);
  const shift = (n: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + n);
    const p = (x: number) => String(x).padStart(2, "0");
    go(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-secondary px-3" onClick={() => shift(-1)} aria-label="Önceki gün">←</button>
      <input type="date" className="input w-auto" value={date} onChange={(e) => e.target.value && go(e.target.value)} />
      <button className="btn-secondary px-3" onClick={() => shift(1)} aria-label="Sonraki gün">→</button>
      {date !== today && <button className="btn text-brand-600 hover:bg-brand-50" onClick={() => go(today)}>Bugün</button>}
    </div>
  );
}
