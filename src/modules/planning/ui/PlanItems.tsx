"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays } from "@/shared/date";
import { isHolidayWeek, itemState, mondayOf, type Range } from "../plan";

type Item = { id: string; topic: string; week: string; endWeek: string; doneDate: string | null };

const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

const STATE = {
  done: { label: "İşlendi", cls: "bg-emerald-50 text-emerald-700" },
  late: { label: "Gecikti", cls: "bg-red-50 text-red-700" },
  current: { label: "Bu hafta", cls: "bg-brand-50 text-brand-700" },
  upcoming: { label: "", cls: "" },
};

/** Planın haftalık konu listesi; "işlendi" işaretlemesi anında kaydedilir. */
export default function PlanItems({ items, holidays, today, startDate }: { items: Item[]; holidays: Range[]; today: string; startDate: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const thisWeek = mondayOf(today);

  async function toggle(it: Item) {
    setPending(it.id);
    const res = await fetch(`/api/kurum/plan/konu/${it.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !it.doneDate, date: today }),
    });
    setPending(null);
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error ?? "Kaydedilemedi.");
    router.refresh();
  }

  if (!items.length) return null;
  const last = items.reduce((a, i) => (i.endWeek > a ? i.endWeek : a), items[0].endWeek);
  const weeks: string[] = [];
  for (let w = mondayOf(startDate); w <= last; w = addDays(w, 7)) weeks.push(w);
  let n = 0;

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-xs text-lead">
          <tr>
            <th className="w-12 px-3 py-2 text-right">#</th>
            <th className="w-40 px-3 py-2">Hafta</th>
            <th className="px-3 py-2">Konu</th>
            <th className="w-44 px-3 py-2">Durum</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule/70">
          {weeks.map((w) => {
            const starting = items.filter((i) => i.week === w);
            const holiday = isHolidayWeek(w, holidays);
            const current = w === thisWeek;
            if (holiday && !starting.length) {
              return (
                <tr key={w} className="bg-red-50/60 text-red-700">
                  <td />
                  <td className="whitespace-nowrap px-3 py-1.5">{fmt(w)} – {fmt(addDays(w, 4))}</td>
                  <td className="px-3 py-1.5" colSpan={2}>Tatil haftası</td>
                </tr>
              );
            }
            if (!starting.length) {
              // Önceki konunun devam haftası
              if (!current) return null;
              const ongoing = items.filter((i) => i.week < w && w <= i.endWeek).map((i) => i.topic);
              return (
                <tr key={w} className="bg-brand-50/50">
                  <td />
                  <td className="whitespace-nowrap px-3 py-1.5 font-medium text-brand-700">{fmt(w)} – {fmt(addDays(w, 4))}</td>
                  <td className="px-3 py-1.5 text-lead" colSpan={2}>Bu hafta: {ongoing.join(", ") || "—"} (devam)</td>
                </tr>
              );
            }
            return starting.map((it, k) => {
              const st = STATE[itemState(it, today)];
              n++;
              let weeksLong = 0;
              for (let x = it.week; x <= it.endWeek; x = addDays(x, 7)) if (!isHolidayWeek(x, holidays)) weeksLong++;
              return (
                <tr key={it.id} className={current ? "bg-brand-50/50" : ""}>
                  <td className="px-3 py-1.5 text-right text-xs text-lead/70">{n}</td>
                  <td className={`whitespace-nowrap px-3 py-1.5 ${current ? "font-medium text-brand-700" : "text-lead"}`}>
                    {k === 0 && (
                      <>
                        {fmt(it.week)} – {fmt(addDays(it.endWeek, 4))}
                        {weeksLong > 1 && <span className="ml-1 text-xs text-lead/70">({weeksLong} hf)</span>}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={!!it.doneDate} disabled={pending === it.id} onChange={() => toggle(it)} className="h-4 w-4 accent-emerald-600" />
                      <span className={it.doneDate ? "text-lead line-through decoration-slate-300" : ""}>{it.topic}</span>
                    </label>
                  </td>
                  <td className="px-3 py-1.5">
                    {st.label && <span className={`badge ${st.cls}`}>{st.label}</span>}
                    {it.doneDate && <span className="ml-1 text-xs text-lead">{fmt(it.doneDate)}</span>}
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}
