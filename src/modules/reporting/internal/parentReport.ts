/**
 * Veli karnesi: bir öğrencinin seçilen dönemdeki deneme, ödev ve devam özeti;
 * paylaşım linkleri (parentToken/parentSharedAt/parentViewedAt) ve öğretmen görüşü (parentNote).
 * Student tablosunun yalnızca bu veli alanlarını reporting yazar.
 */
import { randomBytes } from "crypto";
import type { Student, Classroom } from "@prisma/client";
import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { parseSections, round2 } from "@/modules/exams";
import { listStudents, type StudentFilter } from "@/modules/enrollment/server";
import { attendanceSummary, homeworkSummary } from "./summary";

export const newParentToken = () => randomBytes(18).toString("base64url");

type StudentWithClass = Student & { classroom: Classroom | null };

async function buildParentReport(student: StudentWithClass, from: string, to: string) {
  const studentId = student.id;
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
      score: r.score,
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

  /* ---------------------------------- Devam --------------------------------- */
  const attendance = await prisma.attendance.findMany({
    where: { studentId, session: { date: { gte: from, lte: to } } },
    include: { session: { include: { teacher: true } } },
  });
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
      ...homeworkSummary(homeworks),
      list: homeworks.map((h) => ({ id: h.id, title: h.homework.title, subject: h.homework.subject, due: h.homework.dueDate, status: h.status, note: h.note })),
    },
    attendance: {
      ...attendanceSummary(attendance),
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

/** Kurumun filtreye uyan öğrencilerinin (numara sırasıyla) dönem karneleri. */
export async function parentReports(ownerId: string, filter: StudentFilter, from: string, to: string): Promise<ParentReport[]> {
  const students = await listStudents(ownerId, filter, "number");
  return Promise.all(students.map((s) => buildParentReport(s, from, to)));
}

/**
 * Giriş gerektirmeyen karne: paylaşım anahtarıyla öğrencinin karnesi; anahtar geçersizse null.
 * Görüntüleyen kurum sahibi değilse "veli gördü" zamanı işlenir (kurumun kendi önizlemesi sayılmaz).
 */
export async function parentReportByToken(token: string, from: string, to: string, viewerId: string | null) {
  if (token.length < 20) return null;
  const student = await prisma.student.findUnique({ where: { parentToken: token }, include: { classroom: true } });
  if (!student) return null;
  if (viewerId !== student.ownerId) {
    await prisma.student.update({ where: { id: student.id }, data: { parentViewedAt: new Date() } });
  }
  return buildParentReport(student, from, to);
}

/** Veli paylaşım panelinin öğrenci satırı (ui/veli/share.ts > ShareStudent ile aynı şekil). */
function shareRow(s: StudentWithClass) {
  return {
    id: s.id,
    name: `${s.firstName} ${s.lastName}`,
    studentNo: s.studentNo,
    className: s.classroom?.name ?? "Kurum dışı",
    parentName: s.parentName,
    parentPhone: s.parentPhone,
    token: s.parentToken,
    sharedAt: s.parentSharedAt?.toISOString() ?? null,
    viewedAt: s.parentViewedAt?.toISOString() ?? null,
    note: s.parentNote,
  };
}

/** Kurumun filtreye uyan öğrencileri, veli paylaşım durumlarıyla (numara sırasıyla). */
export async function parentShares(ownerId: string, filter: StudentFilter) {
  const students = await listStudents(ownerId, filter, "number");
  return students.map(shareRow);
}

/**
 * Veli karnesi linklerini yönetir.
 *  - share:  linki olmayanlara link oluşturur (varsa aynısını korur)
 *  - renew:  yeni link üretir (eski link geçersiz olur)
 *  - revoke: linki iptal eder
 * Başka kurumun öğrencileri sessizce atlanır.
 */
export async function manageParentLinks(ownerId: string, body: Record<string, unknown>) {
  const { action, studentIds } = body as { action: string; studentIds: string[] };
  if (!["share", "renew", "revoke"].includes(action) || !Array.isArray(studentIds) || studentIds.length > 2000) {
    throw invalid("Geçersiz istek.");
  }
  const students = await prisma.student.findMany({ where: { ownerId, id: { in: studentIds } } });
  const out: Record<string, { token: string | null; sharedAt: string | null }> = {};
  for (const s of students) {
    let data: { parentToken: string | null; parentSharedAt: Date | null; parentViewedAt?: null };
    if (action === "revoke") data = { parentToken: null, parentSharedAt: null, parentViewedAt: null };
    else if (action === "renew" || !s.parentToken) data = { parentToken: newParentToken(), parentSharedAt: new Date(), parentViewedAt: null };
    else data = { parentToken: s.parentToken, parentSharedAt: s.parentSharedAt };
    const u = await prisma.student.update({ where: { id: s.id }, data });
    out[s.id] = { token: u.parentToken, sharedAt: u.parentSharedAt?.toISOString() ?? null };
  }
  return out;
}

/** Veli karnesindeki öğretmen görüşünü kaydeder (en fazla 2000 karakter). */
export async function saveParentNote(ownerId: string, studentId: string, note: string) {
  const st = await prisma.student.findFirst({ where: { id: studentId, ownerId }, select: { id: true } });
  if (!st) throw notFound("Bulunamadı.");
  await prisma.student.update({ where: { id: st.id }, data: { parentNote: note.trim().slice(0, 2000) } });
}
