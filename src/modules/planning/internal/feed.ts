import { ymd } from "@/shared/date";
import { examsBetween } from "@/modules/exams/server";
import { homeworkDueBetween } from "@/modules/homework/server";
import type { CalendarItem } from "../calendar";
import { listEvents, type DateRange } from "./events";

/**
 * Takvimin tek kaynağı: elle girilen etkinlikler + denemeler + ödev teslimleri, tarihe göre sıralı.
 * `classroomId` verilirse kurum geneli kayıtlar ve o sınıfa ait olanlar döner.
 */
export async function calendarFeed(ownerId: string, range: DateRange, classroomId?: string): Promise<CalendarItem[]> {
  const [events, exams, homework] = await Promise.all([
    listEvents(ownerId, range, classroomId),
    examsBetween(ownerId, range.from, range.to),
    homeworkDueBetween(ownerId, range.from, range.to, classroomId),
  ]);
  const items: CalendarItem[] = [
    ...events.map((e) => ({
      key: `e:${e.id}`,
      kind: e.kind,
      title: e.title,
      start: e.startDate,
      end: e.endDate,
      classroomId: e.classroomId,
      classroom: e.classroom?.name ?? null,
      note: e.note,
      href: null,
      eventId: e.id,
    })),
    ...exams.map((x) => ({
      key: `x:${x.id}`,
      kind: "DENEME",
      title: x.name,
      start: ymd(x.date),
      end: ymd(x.date),
      classroomId: null,
      classroom: null,
      note: x.type,
      href: `/kurum/denemeler/${x.id}`,
      eventId: null,
    })),
    ...homework.map((h) => ({
      key: `h:${h.id}`,
      kind: "ODEV",
      title: `${h.subject}: ${h.title}`,
      start: ymd(h.dueDate),
      end: ymd(h.dueDate),
      classroomId: h.classroomId,
      classroom: h.classroom.name,
      note: "",
      href: `/kurum/odevler/${h.id}`,
      eventId: null,
    })),
  ];
  return items.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, "tr"));
}
