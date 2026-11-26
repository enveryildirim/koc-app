"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays } from "@/shared/date";
import { isHolidayWeek, mondayOf, type Range } from "@/modules/planning";
import type { TopicRow } from "../internal/topicTracking";

const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

const STATE = {
  done: { label: "İşlendi", cls: "bg-emerald-50 text-emerald-700" },
  late: { label: "Gecikti", cls: "bg-red-50 text-red-700" },
  current: { label: "Bu hafta", cls: "bg-brand-50 text-brand-700" },
  upcoming: { label: "İleride", cls: "bg-mist text-lead" },
};

type Filter = "all" | "late" | "open" | "done";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "late", label: "Gecikenler" },
  { key: "open", label: "İşlenmeyenler" },
  { key: "done", label: "İşlenenler" },
];

const tone = (p: number | null) => (p === null ? "" : p < 50 ? "text-red-700" : p < 70 ? "text-amber-700" : "text-emerald-700");

/**
 * Konu takibi tablosu: hafta sırasıyla plan konuları, durumları, işlendiği ders, değerlendirme ve deneme.
 * "İşlendi" kutusu anında kaydedilir. Üniteli planlarda ünite süzgeci çıkar.
 */
export default function TopicTracking({ rows, holidays, today, startDate }: { rows: TopicRow[]; holidays: Range[]; today: string; startDate: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [unit, setUnit] = useState("");
  const units = [...new Set(rows.map((r) => r.unit))].filter(Boolean);
  const thisWeek = mondayOf(today);

  async function toggle(r: TopicRow) {
    setPending(r.id);
    const res = await fetch(`/api/kurum/plan/konu/${r.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !r.doneDate, date: today }),
    });
    setPending(null);
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error ?? "Kaydedilemedi.");
    router.refresh();
  }

  const matches = (r: TopicRow, f: Filter) =>
    (!unit || r.unit === unit) && (f === "all" || (f === "late" ? r.state === "late" : f === "open" ? !r.doneDate : !!r.doneDate));
  const shown = rows.filter((r) => matches(r, filter));

  // Tatil haftaları yalnızca "Tümü" görünümünde konu satırlarının arasına girer
  const lines: ({ kind: "topic"; row: TopicRow; first: boolean } | { kind: "holiday"; week: string })[] = [];
  let prevWeek = "";
  const push = (r: TopicRow) => {
    lines.push({ kind: "topic", row: r, first: r.week !== prevWeek });
    prevWeek = r.week;
  };
  if (shown.length && filter === "all") {
    const last = shown.reduce((a, r) => (r.endWeek > a ? r.endWeek : a), shown[0].endWeek);
    for (let w = mondayOf(startDate); w <= last; w = addDays(w, 7)) {
      const starting = shown.filter((r) => r.week === w);
      if (!starting.length && isHolidayWeek(w, holidays)) lines.push({ kind: "holiday", week: w });
      starting.forEach(push);
    }
  } else shown.forEach(push);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-sm ${filter === f.key ? "bg-graphite text-surface" : "bg-surface ring-1 ring-rule hover:bg-paper"}`}
          >
            {f.label} <span className="num text-xs opacity-75">{rows.filter((r) => matches(r, f.key)).length}</span>
          </button>
        ))}
        {units.length > 0 && (
          <select className="input ml-auto w-auto py-1 text-sm" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Ünite">
            <option value="">Bütün üniteler</option>
            {units.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="card p-6 text-center text-sm text-lead">Bu süzgece uyan konu yok.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs text-lead">
              <tr>
                <th className="w-36 px-3 py-2">Hafta</th>
                <th className="px-3 py-2">Konu</th>
                <th className="w-40 px-3 py-2">Durum</th>
                <th className="w-40 px-3 py-2">Değerlendirme</th>
                <th className="w-36 px-3 py-2">Deneme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {lines.map((l) =>
                l.kind === "holiday" ? (
                  <tr key={l.week} className="bg-red-50/60 text-red-700">
                    <td className="whitespace-nowrap px-3 py-1.5">{fmt(l.week)} – {fmt(addDays(l.week, 4))}</td>
                    <td className="px-3 py-1.5" colSpan={4}>Tatil haftası</td>
                  </tr>
                ) : (
                  <Row
                    key={l.row.id}
                    r={l.row}
                    first={l.first}
                    current={l.row.week <= thisWeek && thisWeek <= l.row.endWeek}
                    pending={pending === l.row.id}
                    onToggle={() => toggle(l.row)}
                    showUnit={units.length > 0 && !unit}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ r, first, current, pending, onToggle, showUnit }: { r: TopicRow; first: boolean; current: boolean; pending: boolean; onToggle: () => void; showUnit: boolean }) {
  const st = STATE[r.state];
  return (
    <tr className={`align-top ${current ? "bg-brand-50/50" : ""}`}>
      <td className={`whitespace-nowrap px-3 py-1.5 ${current ? "font-medium text-brand-700" : "text-lead"}`}>
        {first && (
          <>
            {fmt(r.week)} – {fmt(addDays(r.endWeek, 4))}
          </>
        )}
      </td>
      <td className="px-3 py-1.5">
        <label className="flex cursor-pointer items-start gap-2">
          <input type="checkbox" checked={!!r.doneDate} disabled={pending} onChange={onToggle} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" aria-label={`${r.topic} işlendi`} />
          <span>
            {showUnit && <span className="mr-1.5 text-xs text-lead">{r.unit} ·</span>}
            <span className={r.doneDate ? "text-lead line-through decoration-slate-300" : ""}>{r.topic}</span>
            {r.endWeek > r.week && <span className="ml-1.5 text-xs text-lead">({Math.round((Date.parse(r.endWeek) - Date.parse(r.week)) / 604800000) + 1} hf)</span>}
            {r.curriculum?.code && <span className="ml-1.5 font-mono text-xs text-lead">{r.curriculum.code}</span>}
            {!r.curriculum && (
              <span className="badge ml-1.5 bg-amber-50 text-amber-800" title="Bu konu müfredatta yok; müfredat takibinde sayılmaz.">
                müfredatta yok
              </span>
            )}
            {r.curriculum?.outcome && <span className="block text-xs text-lead">{r.curriculum.outcome}</span>}
          </span>
        </label>
      </td>
      <td className="px-3 py-1.5">
        <span className={`badge ${st.cls}`}>{st.label}</span>
        {r.doneDate &&
          (r.sessionId ? (
            <Link href={`/kurum/yoklama/al?ders=${r.sessionId}`} className="ml-1 text-xs text-lead underline decoration-rule underline-offset-2 hover:text-graphite" title="İşlendiği dersin yoklaması">
              {fmt(r.doneDate)}
            </Link>
          ) : (
            <span className="ml-1 text-xs text-lead">{fmt(r.doneDate)}</span>
          ))}
      </td>
      <td className="px-3 py-1.5 text-xs">
        {r.assessments.length ? (
          <ul className="space-y-0.5">
            {r.assessments.map((a) => (
              <li key={a.id}>
                <Link href={`/kurum/degerlendirme/${a.id}`} className="hover:underline">{a.title || fmt(a.date)}</Link>
                {a.avg !== null && <span className={`ml-1 font-semibold ${tone(a.avg)}`}>%{a.avg}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-lead/60">—</span>
        )}
      </td>
      <td className="px-3 py-1.5 text-xs">
        {r.exams.length ? (
          <ul className="space-y-0.5">
            {r.exams.map((e) => (
              <li key={e.id} title={`${e.questions} soru`}>
                <Link href={`/kurum/denemeler/${e.id}`} className="hover:underline">{e.name}</Link>
                <span className={`ml-1 font-semibold ${tone(e.rate)}`}>%{e.rate}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-lead/60">—</span>
        )}
      </td>
    </tr>
  );
}
