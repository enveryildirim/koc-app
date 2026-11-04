"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addMonths, monthGrid, monthLabel } from "@/shared/date";
import { ALL_KINDS, covers, EVENT_KINDS, schoolYearLabel, schoolYearMonths, schoolYearOf, type CalendarItem } from "../calendar";
import EventForm, { type EventDraft } from "./EventForm";

export type CalendarViewMode = "ay" | "yil" | "liste";

type Props = {
  view: CalendarViewMode;
  month: string;
  year: number;
  today: string;
  items: CalendarItem[];
  classrooms: { id: string; name: string }[];
  classroomId: string;
};

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) =>
  new Date(d + "T12:00:00").toLocaleDateString("tr-TR", opts);

export default function CalendarView(p: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const href = (q: { gorunum?: CalendarViewMode; ay?: string; yil?: number; sinif?: string }) => {
    const s = new URLSearchParams();
    const view = q.gorunum ?? p.view;
    s.set("gorunum", view);
    if (view === "ay") s.set("ay", q.ay ?? p.month);
    else s.set("yil", String(q.yil ?? p.year));
    const sinif = q.sinif ?? p.classroomId;
    if (sinif) s.set("sinif", sinif);
    return `/kurum/takvim?${s}`;
  };

  const newEvent = (date: string) =>
    setDraft({ title: "", kind: "EVENT", startDate: date, endDate: date, classroomId: p.classroomId, note: "", parentVisible: EVENT_KINDS.EVENT.parentDefault });
  const open = (i: CalendarItem) => {
    if (i.eventId)
      setDraft({ id: i.eventId, title: i.title, kind: i.kind, startDate: i.start, endDate: i.end, classroomId: i.classroomId ?? "", note: i.note, parentVisible: i.parentVisible });
    else if (i.href) router.push(i.href);
  };

  async function addHolidays() {
    if (!confirm(`${schoolYearLabel(p.year)} eğitim yılının sabit tarihli resmî tatilleri (29 Ekim, 23 Nisan, 19 Mayıs…) eklensin mi?`)) return;
    setBusy(true);
    const res = await fetch("/api/kurum/takvim/resmi-tatiller", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: p.year }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return alert(json.error ?? "Eklenemedi.");
    alert(`${json.added} resmî tatil eklendi. Dinî bayramları ve ara tatilleri "+ Etkinlik" ile ekleyin.`);
    router.refresh();
  }

  const prevNext =
    p.view === "ay"
      ? { prev: href({ ay: addMonths(p.month, -1) }), next: href({ ay: addMonths(p.month, 1) }), title: monthLabel(p.month) }
      : { prev: href({ yil: p.year - 1 }), next: href({ yil: p.year + 1 }), title: `${schoolYearLabel(p.year)} eğitim yılı` };

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-mist p-1 text-sm">
          {(
            [
              ["ay", "Ay"],
              ["yil", "Yıl"],
              ["liste", "Liste"],
            ] as const
          ).map(([k, label]) => (
            <Link
              key={k}
              href={href({ gorunum: k, ay: k === "ay" && p.view !== "ay" ? (schoolYearOf(p.today) === p.year ? p.today.slice(0, 7) : `${p.year}-09`) : undefined })}
              className={`rounded-md px-3 py-1 font-medium ${p.view === k ? "bg-white shadow-sm" : "text-lead"}`}
            >
              {label}
            </Link>
          ))}
        </div>
        <Link href={prevNext.prev} className="btn-secondary px-2 py-1" aria-label="Önceki">‹</Link>
        <Link href={prevNext.next} className="btn-secondary px-2 py-1" aria-label="Sonraki">›</Link>
        <h2 className="min-w-40 text-lg font-semibold capitalize">{prevNext.title}</h2>
        <Link href={href({ ay: p.today.slice(0, 7), yil: schoolYearOf(p.today) })} className="text-sm text-brand-700 hover:underline">
          Bugün
        </Link>
        <div className="flex-1" />
        <select className="input w-auto" value={p.classroomId} onChange={(e) => router.push(href({ sinif: e.target.value }))}>
          <option value="">Tüm kurum</option>
          {p.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn-secondary" disabled={busy} onClick={addHolidays}>Resmî tatilleri ekle</button>
        <button className="btn-primary" onClick={() => newEvent(p.view === "ay" && !p.today.startsWith(p.month) ? `${p.month}-01` : p.today)}>
          + Etkinlik
        </button>
      </div>

      <div className="no-print mb-4 flex flex-wrap gap-3 text-xs text-lead">
        {Object.entries(ALL_KINDS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-full ${v.dot}`} />
            {v.label}
          </span>
        ))}
      </div>

      {p.view === "ay" && <MonthView {...p} onDay={newEvent} onItem={open} />}
      {p.view === "yil" && <YearView {...p} monthHref={(m) => href({ gorunum: "ay", ay: m })} />}
      {p.view === "liste" && <ListView {...p} onItem={open} />}

      {draft && <EventForm initial={draft} classrooms={p.classrooms} onClose={() => setDraft(null)} />}
    </div>
  );
}

function Chip({ item, onClick }: { item: CalendarItem; onClick: () => void }) {
  const k = ALL_KINDS[item.kind] ?? ALL_KINDS.OTHER;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={[item.title, item.classroom, item.note].filter(Boolean).join(" · ")}
      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-xs ring-1 ring-inset ${k.cls}`}
    >
      {item.classroom && <span className="font-semibold">{item.classroom} · </span>}
      {item.title}
    </button>
  );
}

function MonthView({ month, today, items, onDay, onItem }: Props & { onDay: (d: string) => void; onItem: (i: CalendarItem) => void }) {
  const weeks = monthGrid(month);
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-rule bg-paper text-center text-xs font-semibold text-lead">
        {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      {weeks.map((w) => (
        <div key={w[0]} className="grid grid-cols-7 border-b border-rule/70 last:border-0">
          {w.map((d, i) => {
            const list = items.filter((x) => covers(x, d));
            const holiday = list.some((x) => x.kind === "HOLIDAY" && !x.classroomId);
            const inMonth = d.startsWith(month);
            return (
              <div
                key={d}
                onClick={() => onDay(d)}
                className={`min-h-28 cursor-pointer border-r border-rule/70 p-1.5 last:border-0 hover:bg-paper ${
                  holiday ? "bg-red-50/60" : i >= 5 ? "bg-paper/60" : ""
                } ${inMonth ? "" : "opacity-40"}`}
              >
                <div className={`mb-1 text-right text-xs ${d === today ? "font-bold text-brand-700" : "text-lead"}`}>
                  {d === today ? <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-white">{Number(d.slice(8))}</span> : Number(d.slice(8))}
                </div>
                <div className="space-y-0.5">
                  {list.slice(0, 3).map((x) => <Chip key={x.key} item={x} onClick={() => onItem(x)} />)}
                  {list.length > 3 && <div className="px-1 text-xs text-lead">+{list.length - 3} daha</div>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function YearView({ year, today, items, monthHref }: Props & { monthHref: (m: string) => string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {schoolYearMonths(year).map((m) => {
        const inMonth = items.filter((x) => x.start <= `${m}-31` && x.end >= `${m}-01`);
        return (
          <Link key={m} href={monthHref(m)} className="card p-3 transition hover:ring-brand-500">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold capitalize">{monthLabel(m)}</span>
              {inMonth.length > 0 && <span className="text-xs text-lead">{inMonth.length} kayıt</span>}
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
              {WEEKDAYS.map((d) => <div key={d} className="text-lead/70">{d[0]}</div>)}
              {monthGrid(m).flat().map((d) => {
                if (!d.startsWith(m)) return <div key={d} />;
                const list = inMonth.filter((x) => covers(x, d));
                const holiday = list.some((x) => x.kind === "HOLIDAY");
                const kinds = [...new Set(list.filter((x) => x.kind !== "HOLIDAY").map((x) => x.kind))].slice(0, 3);
                return (
                  <div
                    key={d}
                    title={list.map((x) => x.title).join("\n")}
                    className={`rounded py-0.5 ${holiday ? "bg-red-100 text-red-700" : ""} ${d === today ? "ring-1 ring-brand-600" : ""}`}
                  >
                    {Number(d.slice(8))}
                    <div className="flex h-1 justify-center gap-0.5">
                      {kinds.map((k) => <span key={k} className={`h-1 w-1 rounded-full ${ALL_KINDS[k]?.dot}`} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function ListView({ items, year, onItem }: Props & { onItem: (i: CalendarItem) => void }) {
  if (!items.length) return <div className="card p-10 text-center text-sm text-lead">{schoolYearLabel(year)} eğitim yılı için kayıt yok.</div>;
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-xs text-lead">
          <tr>
            <th className="px-4 py-2">Tarih</th>
            <th className="px-4 py-2">Tür</th>
            <th className="px-4 py-2">Başlık</th>
            <th className="px-4 py-2">Kimin için</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule/70">
          {items.map((x) => {
            const k = ALL_KINDS[x.kind] ?? ALL_KINDS.OTHER;
            return (
              <tr key={x.key} className={x.eventId || x.href ? "cursor-pointer hover:bg-paper" : ""} onClick={() => onItem(x)}>
                <td className="whitespace-nowrap px-4 py-2">
                  {fmtDay(x.start, { day: "numeric", month: "long", weekday: "short" })}
                  {x.end !== x.start && ` – ${fmtDay(x.end)}`}
                </td>
                <td className="px-4 py-2"><span className={`badge ring-1 ring-inset ${k.cls}`}>{k.label}</span></td>
                <td className="px-4 py-2 font-medium">
                  {x.title}
                  {x.note && x.kind !== "DENEME" && <div className="text-xs font-normal text-lead">{x.note}</div>}
                </td>
                <td className="px-4 py-2 text-lead">
                  {x.classroom ?? "Tüm kurum"}
                  {x.eventId && x.parentVisible && <span className="ml-1" title="Velilere gösteriliyor">👪</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
