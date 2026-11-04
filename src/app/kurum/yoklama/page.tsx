import Link from "next/link";
import { classroomsOf } from "@/modules/enrollment/server";
import { dayOfWeek, ymd } from "@/shared/date";
import { DAYS, LESSON_TYPES } from "@/modules/schedule";
import { requireOwner } from "@/modules/identity/server";
import { lessonsOn, listTeachers } from "@/modules/schedule/server";
import { holidaysOn } from "@/modules/planning/server";
import { Empty, Kpi, PageHeader } from "@/shared/ui/kurum";
import DateNav from "@/modules/schedule/ui/DateNav";
import ExtraLessonForm from "@/modules/schedule/ui/ExtraLessonForm";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ tarih?: string }> }) {
  const ownerId = await requireOwner();
  const { tarih } = await searchParams;
  const today = ymd();
  const date = tarih && /^\d{4}-\d{2}-\d{2}$/.test(tarih) ? tarih : today;
  const dow = dayOfWeek(date);

  const [lessons, classrooms, teachers, holidays] = await Promise.all([
    lessonsOn(ownerId, date),
    classroomsOf(ownerId),
    listTeachers(ownerId),
    holidaysOn(ownerId, date),
  ]);
  const holidayFor = (classroomId: string) => holidays.find((h) => !h.classroomId || h.classroomId === classroomId);
  const rows = lessons.map((l) => ({
    ...l,
    holiday: l.taken ? undefined : holidayFor(l.classroomId),
    key: l.extra ? l.sessionId! : l.slotId!,
    href: l.extra ? `/kurum/yoklama/al?ders=${l.sessionId}` : `/kurum/yoklama/al?program=${l.slotId}&tarih=${date}`,
  }));

  const taken = rows.filter((r) => r.taken).length;
  const expected = rows.filter((r) => !r.holiday).length;
  const absent = rows.reduce((s, r) => s + r.absent, 0);

  return (
    <div>
      <PageHeader
        title="Yoklama"
        sub={`${new Date(date + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} · ${DAYS[dow]}`}
        actions={
          <>
            <ExtraLessonForm
              date={date}
              classrooms={classrooms.map((c) => ({ id: c.id, name: c.name }))}
              teachers={teachers.map((t) => ({ id: t.id, name: t.name, branch: t.branch }))}
            />
            <Link href="/kurum/raporlar" className="btn-secondary">📈 Devam raporları</Link>
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <DateNav date={date} today={today} base="/kurum/yoklama" />
      </div>
      {holidays.length > 0 && (
        <div className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          <span className="font-semibold">Takvimde tatil:</span>{" "}
          {holidays.map((h) => `${h.title}${h.classroom ? ` (${h.classroom.name})` : ""}`).join(", ")}.{" "}
          <Link href={`/kurum/takvim?ay=${date.slice(0, 7)}`} className="underline">Takvimde gör</Link>
        </div>
      )}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Kpi label="Ders" value={rows.length} />
        <Kpi label="Yoklaması alınan" value={`${taken} / ${expected}`} hint={expected < rows.length ? `${rows.length - expected} ders tatil` : undefined} />
        <Kpi label="Gelmeyen (toplam)" value={absent} />
      </div>

      {rows.length === 0 ? (
        <Empty>Bu gün için programda ders yok. Ek ders / etüt ekleyerek yoklama alabilirsiniz.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <Link key={r.key} href={r.href} className="card flex items-start gap-3 p-4 transition hover:ring-brand-500">
              <div className="rounded-lg bg-slate-900 px-2 py-1 text-center font-mono text-xs leading-tight text-white">
                {r.startTime}
                <br />
                {r.endTime}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.subject}</span>
                  <span className="badge bg-slate-100 text-slate-600">{r.classroom}</span>
                </div>
                <div className="text-sm text-slate-500">
                  {r.teacher}
                  {r.lessonType !== "GRUP" && ` · ${LESSON_TYPES[r.lessonType]}`}
                  {r.extra && " · ek ders"}
                </div>
                <div className="mt-2">
                  {r.holiday ? (
                    <span className="badge bg-red-50 text-red-700">Tatil · {r.holiday.title}</span>
                  ) : r.taken ? (
                    <span className="badge bg-emerald-50 text-emerald-700">
                      ✓ Yoklama alındı{r.absent > 0 ? ` · ${r.absent} gelmedi` : ""}
                    </span>
                  ) : (
                    <span className="badge bg-amber-50 text-amber-700">Yoklama bekliyor · {r.total} öğrenci</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
