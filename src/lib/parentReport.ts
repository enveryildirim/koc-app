/** Veli karnesi: bir öğrencinin seçilen dönemdeki deneme, ödev ve devam özeti. */
import { randomBytes } from "crypto";
import { prisma } from "./db";
import { parseSections, round2 } from "./exam";

export const newParentToken = () => randomBytes(18).toString("base64url");

/** Varsayılan dönem: son 30 gün (YYYY-MM-DD). */
export function defaultPeriod() {
  const to = new Date();
  const from = new Date(Date.now() - 30 * 86400000);
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: f(from), to: f(to) };
}

/** Geçersiz/eksik tarihleri varsayılana çeker; from > to ise yer değiştirir. */
export function normalizePeriod(from?: string, to?: string) {
  const d = defaultPeriod();
  const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
  let f = ok(from) ? from! : d.from;
  let t = ok(to) ? to! : d.to;
  if (f > t) [f, t] = [t, f];
  return { from: f, to: t };
}

export async function buildParentReport(studentId: string, from: string, to: string) {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { classroom: true } });
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: student.ownerId }, select: { name: true } });
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T23:59:59");

  /* ------------------------------- Denemeler ------------------------------- */
  const results = await prisma.examResult.findMany({
    where: { studentId, exam: { date: { gte: start, lte: end } } },
    include: { exam: true },
    orderBy: { exam: { date: "asc" } },
  });
  const exams = [];
  for (const r of results) {
    const secs = parseSections(r.exam.sections);
    const stats = JSON.parse(r.stats) as { d: number; y: number; b: number; net: number }[];
    // Sınıf içi karşılaştırma (sınıfsız öğrencide kurum geneli)
    const peers = await prisma.examResult.findMany({
      where: { examId: r.examId, ...(student.classroomId ? { student: { classroomId: student.classroomId } } : {}) },
      select: { totalNet: true, stats: true },
    });
    const peerStats = peers.map((p) => JSON.parse(p.stats) as { net: number }[]);
    const better = peers.filter((p) => p.totalNet > r.totalNet).length;
    exams.push({
      id: r.id,
      examId: r.examId,
      name: r.exam.name,
      type: r.exam.type,
      date: r.exam.date,
      sections: secs.map((s, i) => ({
        name: s.name,
        count: s.count,
        ...stats[i],
        classAvg: round2(peerStats.reduce((a, p) => a + (p[i]?.net ?? 0), 0) / Math.max(1, peerStats.length)),
      })),
      totalNet: r.totalNet,
      maxNet: secs.reduce((a, s) => a + s.count, 0),
      classAvg: round2(peers.reduce((a, p) => a + p.totalNet, 0) / Math.max(1, peers.length)),
      rank: better + 1,
      peers: peers.length,
    });
  }

  /* --------------------------------- Ödevler -------------------------------- */
  const homeworks = await prisma.homeworkStatus.findMany({
    where: { studentId, homework: { dueDate: { gte: start, lte: end } } },
    include: { homework: true },
    orderBy: { homework: { dueDate: "desc" } },
  });
  const hw = { DONE: 0, PARTIAL: 0, NOT_DONE: 0, PENDING: 0 } as Record<string, number>;
  homeworks.forEach((h) => (hw[h.status] = (hw[h.status] ?? 0) + 1));
  const hwGraded = hw.DONE + hw.PARTIAL + hw.NOT_DONE;

  /* ---------------------------------- Devam --------------------------------- */
  const attendance = await prisma.attendance.findMany({
    where: { studentId, session: { date: { gte: from, lte: to } } },
    include: { session: { include: { teacher: true } } },
  });
  const att = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<string, number>;
  attendance.forEach((a) => (att[a.status] = (att[a.status] ?? 0) + 1));
  const absences = attendance
    .filter((a) => a.status !== "PRESENT")
    .sort((a, b) => b.session.date.localeCompare(a.session.date) || b.session.startTime.localeCompare(a.session.startTime));

  return {
    institution: owner.name,
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      studentNo: student.studentNo,
      className: student.classroom?.name ?? (student.external ? "Kurum dışı" : "—"),
      parentName: student.parentName,
      note: student.parentNote,
    },
    period: { from, to },
    exams,
    homework: {
      counts: hw,
      rate: hwGraded ? Math.round((hw.DONE / hwGraded) * 100) : null,
      list: homeworks.map((h) => ({ id: h.id, title: h.homework.title, subject: h.homework.subject, due: h.homework.dueDate, status: h.status, note: h.note })),
    },
    attendance: {
      counts: att,
      total: attendance.length,
      rate: attendance.length ? Math.round(((att.PRESENT + att.LATE) / attendance.length) * 100) : null,
      list: absences.map((a) => ({
        id: a.id,
        date: a.session.date,
        time: `${a.session.startTime}–${a.session.endTime}`,
        subject: a.session.subject,
        teacher: a.session.teacher.name,
        status: a.status,
      })),
    },
  };
}

export type ParentReport = Awaited<ReturnType<typeof buildParentReport>>;
