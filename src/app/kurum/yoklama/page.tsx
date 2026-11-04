import Link from "next/link";
import { classroomsOf } from "@/modules/enrollment/server";
import { dayOfWeek, ymd } from "@/shared/date";
import { DAYS } from "@/modules/schedule";
import { requireOwner } from "@/modules/identity/server";
import { lessonsOn, listTeachers } from "@/modules/schedule/server";
import { holidaysOn } from "@/modules/planning/server";
import { Empty, PageHeader } from "@/shared/ui/kurum";
import DateNav from "@/modules/schedule/ui/DateNav";
import ExtraLessonForm from "@/modules/schedule/ui/ExtraLessonForm";
import LessonDay from "@/modules/schedule/ui/LessonDay";

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
  const rows = lessons.map((l) => {
    const holiday = l.taken ? undefined : holidayFor(l.classroomId);
    return {
      key: l.extra ? l.sessionId! : l.slotId!,
      href: l.extra ? `/kurum/yoklama/al?ders=${l.sessionId}` : `/kurum/yoklama/al?program=${l.slotId}&tarih=${date}`,
      startTime: l.startTime,
      endTime: l.endTime,
      classroom: l.classroom,
      subject: l.subject,
      teacher: l.teacher,
      lessonType: l.lessonType,
      extra: l.extra,
      state: (l.taken ? "taken" : holiday ? "holiday" : "pending") as "taken" | "holiday" | "pending",
      detail: l.taken ? (l.absent ? `${l.absent} öğrenci gelmedi` : "hepsi geldi") : holiday ? holiday.title : `${l.total} öğrenci`,
    };
  });

  const taken = rows.filter((r) => r.state === "taken").length;
  const expected = rows.filter((r) => r.state !== "holiday").length;
  const absent = lessons.reduce((s, r) => s + r.absent, 0);
  const longDate = new Date(date + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader
        title="Yoklama"
        sub={`${DAYS[dow]}, ${longDate}${date === today ? " (bugün)" : ""}`}
        actions={
          <>
            <ExtraLessonForm
              date={date}
              classrooms={classrooms.map((c) => ({ id: c.id, name: c.name }))}
              teachers={teachers.map((t) => ({ id: t.id, name: t.name, branch: t.branch }))}
            />
            <Link href="/kurum/raporlar" className="btn-secondary">Devam raporları</Link>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <DateNav date={date} today={today} base="/kurum/yoklama" />
        {rows.length > 0 && (
          <p className="num text-[15px] text-lead">
            <b className="text-graphite">{taken}</b> / {expected} yoklama alındı
            {absent > 0 && <>, <span className="text-red-700">{absent} öğrenci gelmedi</span></>}
            {expected < rows.length && `, ${rows.length - expected} ders tatil`}
          </p>
        )}
      </div>

      {holidays.length > 0 && (
        <p className="mb-5 rounded-md border-l-[3px] border-red-700 bg-white px-4 py-3 text-[15px]">
          Takvimde tatil: {holidays.map((h) => `${h.title}${h.classroom ? ` (${h.classroom.name})` : ""}`).join(", ")}.{" "}
          <Link href={`/kurum/takvim?ay=${date.slice(0, 7)}`} className="font-semibold underline decoration-ink/40 underline-offset-4">Takvimde gör</Link>
        </p>
      )}

      {rows.length === 0 ? (
        <Empty>Bu gün için programda ders yok. Etüt veya özel ders için &quot;Ek ders ekle&quot; ile yoklama alabilirsiniz.</Empty>
      ) : (
        <LessonDay lessons={rows} />
      )}
    </div>
  );
}
