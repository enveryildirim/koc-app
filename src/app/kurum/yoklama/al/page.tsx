import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fullName, LESSON_TYPES, requireOwner } from "@/lib/kurum";
import { PageHeader } from "@/components/kurum/ui";
import AttendanceForm from "@/components/kurum/program/AttendanceForm";

export const dynamic = "force-dynamic";

type SP = Promise<{ program?: string; tarih?: string; ders?: string }>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;

  let info: { classroomId: string; classroom: string; subject: string; teacher: string; lessonType: string; startTime: string; endTime: string; date: string };
  let target: { slotId?: string; sessionId?: string };
  let sessionId: string | null = null;
  let extra = false;

  if (sp.ders) {
    const s = await prisma.lessonSession.findUnique({ where: { id: sp.ders }, include: { classroom: true, teacher: true } });
    if (!s || s.ownerId !== ownerId) notFound();
    info = { classroomId: s.classroomId, classroom: s.classroom.name, subject: s.subject, teacher: s.teacher.name, lessonType: s.lessonType, startTime: s.startTime, endTime: s.endTime, date: s.date };
    target = { sessionId: s.id };
    sessionId = s.id;
    extra = !s.slotId;
  } else if (sp.program && sp.tarih && /^\d{4}-\d{2}-\d{2}$/.test(sp.tarih)) {
    const sl = await prisma.scheduleSlot.findUnique({ where: { id: sp.program }, include: { classroom: true, teacher: true } });
    if (!sl || sl.ownerId !== ownerId) notFound();
    info = { classroomId: sl.classroomId, classroom: sl.classroom.name, subject: sl.subject, teacher: sl.teacher.name, lessonType: sl.lessonType, startTime: sl.startTime, endTime: sl.endTime, date: sp.tarih };
    target = { slotId: sl.id };
    const s = await prisma.lessonSession.findUnique({ where: { slotId_date: { slotId: sl.id, date: sp.tarih } } });
    sessionId = s?.id ?? null;
  } else notFound();

  const [students, existing] = await Promise.all([
    prisma.student.findMany({ where: { ownerId, classroomId: info.classroomId }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    sessionId ? prisma.attendance.findMany({ where: { sessionId } }) : Promise.resolve([]),
  ]);
  const initial = Object.fromEntries(existing.map((a) => [a.studentId, a.status]));
  const dateLabel = new Date(info.date + "T12:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <PageHeader
        back={{ href: `/kurum/yoklama?tarih=${info.date}`, label: "Günün dersleri" }}
        title={`${info.subject} · ${info.classroom}`}
        sub={`${dateLabel} · ${info.startTime}–${info.endTime} · ${info.teacher} · ${LESSON_TYPES[info.lessonType] ?? info.lessonType}${existing.length ? " · yoklama daha önce alınmış, güncelleyebilirsiniz" : ""}`}
      />
      <AttendanceForm
        students={students.map((s) => ({ id: s.id, no: s.studentNo, name: fullName(s) }))}
        initial={initial}
        target={target}
        date={info.date}
        backHref={`/kurum/yoklama?tarih=${info.date}`}
        deletable={extra && sessionId ? sessionId : undefined}
      />
    </div>
  );
}
