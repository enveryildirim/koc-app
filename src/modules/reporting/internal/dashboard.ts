/** Kurum özeti (ana sayfa) verisi. */
import { prisma } from "@/shared/db";
import { dayOfWeek, ymd } from "@/shared/date";

const count = (arr: { status: string; _count: number }[], s: string) => arr.find((a) => a.status === s)?._count ?? 0;
const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

/** Kurumun bugünkü ve son 30 günlük özeti. */
export async function institutionDashboard(ownerId: string) {
  const today = ymd();
  const monthAgo = ymd(new Date(Date.now() - 30 * 86400000));
  const dow = dayOfWeek(today);

  const [studentCount, classCount, exams, todaySlots, todaySessions, att, hw, upcoming, absentTop] = await Promise.all([
    prisma.student.count({ where: { ownerId, external: false } }),
    prisma.classroom.count({ where: { ownerId } }),
    prisma.exam.findMany({ where: { ownerId }, orderBy: { date: "desc" }, take: 5, include: { results: { select: { totalNet: true } } } }),
    prisma.scheduleSlot.findMany({ where: { ownerId, dayOfWeek: dow }, include: { classroom: true, teacher: true }, orderBy: { startTime: "asc" } }),
    prisma.lessonSession.findMany({ where: { ownerId, date: today }, select: { slotId: true } }),
    prisma.attendance.groupBy({ by: ["status"], where: { session: { ownerId, date: { gte: monthAgo } } }, _count: true }),
    prisma.homeworkStatus.groupBy({ by: ["status"], where: { homework: { ownerId, dueDate: { gte: new Date(monthAgo) } } }, _count: true }),
    prisma.homework.findMany({
      where: { ownerId, dueDate: { gte: new Date(today) } },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: { classroom: true },
    }),
    // Son 30 günde en çok devamsızlık yapanlar
    prisma.attendance.groupBy({
      by: ["studentId"],
      where: { status: "ABSENT", session: { ownerId, date: { gte: monthAgo } } },
      _count: true,
      orderBy: { _count: { studentId: "desc" } },
      take: 6,
    }),
  ]);
  const absentStudents = await prisma.student.findMany({ where: { ownerId, id: { in: absentTop.map((a) => a.studentId) } }, include: { classroom: true } });

  const attTotal = att.reduce((s, a) => s + a._count, 0);
  const hwGraded = count(hw, "DONE") + count(hw, "PARTIAL") + count(hw, "NOT_DONE");
  const taken = new Set(todaySessions.map((s) => s.slotId));

  return {
    today,
    dow,
    studentCount,
    classCount,
    /** Son 5 deneme (yeniden eskiye), katılım ve ortalama netle. */
    exams: exams.map(({ results, ...e }) => ({ ...e, participants: results.length, avgNet: avg(results.map((r) => r.totalNet)) })),
    /** Bugünün program dersleri; `taken`: yoklaması alındı mı. */
    todaySlots: todaySlots.map((s) => ({ ...s, taken: taken.has(s.id) })),
    attendance: {
      absent: count(att, "ABSENT"),
      rate: attTotal ? Math.round(((count(att, "PRESENT") + count(att, "LATE")) / attTotal) * 100) : null,
    },
    homework: {
      notDone: count(hw, "NOT_DONE"),
      rate: hwGraded ? Math.round((count(hw, "DONE") / hwGraded) * 100) : null,
    },
    upcomingHomework: upcoming,
    topAbsentees: absentTop.flatMap((a) => {
      const student = absentStudents.find((s) => s.id === a.studentId);
      return student ? [{ student, absent: a._count }] : [];
    }),
  };
}
