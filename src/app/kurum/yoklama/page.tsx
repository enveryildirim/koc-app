import Link from "next/link";
import { prisma } from "@/shared/db";
import { classroomsOf } from "@/modules/enrollment/server";
import { dayOfWeek, ymd } from "@/shared/date";
import { DAYS, LESSON_TYPES } from "@/modules/schedule";
import { requireOwner } from "@/modules/identity/server";
import { Empty, Kpi, PageHeader } from "@/shared/ui/kurum";
import DateNav from "@/modules/schedule/ui/DateNav";
import ExtraLessonForm from "@/modules/schedule/ui/ExtraLessonForm";

export const dynamic = "force-dynamic";

type Row = {
  key: string;
  href: string;
  classroom: string;
  subject: string;
  teacher: string;
  lessonType: string;
  startTime: string;
  endTime: string;
  taken: boolean;
  absent: number;
  total: number;
  extra: boolean;
};

export default async function Page({ searchParams }: { searchParams: Promise<{ tarih?: string }> }) {
  const ownerId = await requireOwner();
  const { tarih } = await searchParams;
  const today = ymd();
  const date = tarih && /^\d{4}-\d{2}-\d{2}$/.test(tarih) ? tarih : today;
  const dow = dayOfWeek(date);

  const [slots, sessions, classrooms, teachers] = await Promise.all([
    prisma.scheduleSlot.findMany({
      where: { ownerId, dayOfWeek: dow },
      include: { classroom: { include: { _count: { select: { students: true } } } }, teacher: true },
    }),
    prisma.lessonSession.findMany({
      where: { ownerId, date },
      include: { classroom: { include: { _count: { select: { students: true } } } }, teacher: true, attendances: { select: { status: true } } },
    }),
    classroomsOf(ownerId),
    prisma.teacher.findMany({ where: { ownerId }, orderBy: { name: "asc" } }),
  ]);

  const bySlot = new Map(sessions.filter((s) => s.slotId).map((s) => [s.slotId!, s]));
  const rows: Row[] = [
    ...slots.map((sl) => {
      const s = bySlot.get(sl.id);
      return {
        key: sl.id,
        href: `/kurum/yoklama/al?program=${sl.id}&tarih=${date}`,
        classroom: sl.classroom.name,
        subject: sl.subject,
        teacher: sl.teacher.name,
        lessonType: sl.lessonType,
        startTime: sl.startTime,
        endTime: sl.endTime,
        taken: !!s && s.attendances.length > 0,
        absent: s?.attendances.filter((a) => a.status === "ABSENT").length ?? 0,
        total: sl.classroom._count.students,
        extra: false,
      };
    }),
    // Programdan silinmiş ya da ek dersler
    ...sessions
      .filter((s) => !s.slotId || !slots.some((sl) => sl.id === s.slotId))
      .map((s) => ({
        key: s.id,
        href: `/kurum/yoklama/al?ders=${s.id}`,
        classroom: s.classroom.name,
        subject: s.subject,
        teacher: s.teacher.name,
        lessonType: s.lessonType,
        startTime: s.startTime,
        endTime: s.endTime,
        taken: s.attendances.length > 0,
        absent: s.attendances.filter((a) => a.status === "ABSENT").length,
        total: s.classroom._count.students,
        extra: true,
      })),
  ].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.classroom.localeCompare(b.classroom, "tr"));

  const taken = rows.filter((r) => r.taken).length;
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
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Kpi label="Ders" value={rows.length} />
        <Kpi label="Yoklaması alınan" value={`${taken} / ${rows.length}`} />
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
                  {r.taken ? (
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
