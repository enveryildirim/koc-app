import Link from "next/link";
import { LESSON_TYPES } from "../labels";

export type DayLesson = {
  key: string;
  href: string;
  startTime: string;
  endTime: string;
  classroom: string;
  subject: string;
  teacher: string;
  lessonType: string;
  /** taken: yoklama alındı · pending: bekliyor · holiday: takvimde tatil */
  state: "taken" | "pending" | "holiday";
  /** Kısa durum bilgisi (ör. "21 öğrenci", "3 öğrenci gelmedi") */
  detail?: string;
  extra?: boolean;
};

const MARK = {
  taken: { cls: "border-graphite bg-graphite", label: "Yoklama alındı" },
  pending: { cls: "border-ink", label: "Yoklama bekliyor" },
  holiday: { cls: "border-lead/40", label: "Tatil" },
};

/** Günün dersleri, başlangıç saatine göre satırlar halinde. Her ders bir cevap baloncuğuyla işaretlenir. */
export default function LessonDay({ lessons }: { lessons: DayLesson[] }) {
  const byTime = new Map<string, DayLesson[]>();
  for (const l of [...lessons].sort((a, b) => a.startTime.localeCompare(b.startTime)))
    byTime.set(l.startTime, [...(byTime.get(l.startTime) ?? []), l]);
  return (
    <ol className="card divide-y divide-rule/70">
      {[...byTime.entries()].map(([time, list]) => (
        <li key={time} className="grid grid-cols-[4rem_1fr] gap-4 px-4 py-3 sm:grid-cols-[4.5rem_1fr]">
          <div className="num pt-1.5 text-[15px] font-semibold">
            {time}
            <div className="text-xs font-normal text-lead">{list[0].endTime}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {list.map((l) => {
              const m = MARK[l.state];
              const meta = [l.teacher, l.lessonType !== "GRUP" ? LESSON_TYPES[l.lessonType]?.toLocaleLowerCase("tr-TR") : null, l.extra ? "ek ders" : null]
                .filter(Boolean)
                .join(", ");
              return (
                <Link
                  key={l.key}
                  href={l.href}
                  className={`flex min-w-56 flex-1 items-start gap-3 rounded-md px-3 py-2 ring-1 ring-rule ring-inset transition-colors hover:ring-graphite ${
                    l.state === "holiday" ? "bg-paper text-lead" : ""
                  }`}
                >
                  <span role="img" aria-label={m.label} className={`mt-1 size-3 shrink-0 rounded-full border-[1.5px] ${m.cls}`} />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{l.classroom}</span> {l.subject}
                    <span className="block text-[13px] text-lead">{meta}</span>
                  </span>
                  {l.detail && (
                    <span className={`shrink-0 pt-0.5 text-[13px] ${l.state === "taken" && l.detail.includes("gelmedi") ? "text-red-700" : "text-lead"}`}>
                      {l.detail}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}
