import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { getClassroom, listStudents } from "@/modules/enrollment/server";
import { teachesSubject } from "@/modules/schedule/server";
import { HOMEWORK, emptyCounts, tally, type StatusCounts } from "../labels";

/** `teacherId`: öğretmen oturumu; yalnızca girdiği sınıf + dersin ödevleri. */
type Opts = { teacherId?: string };

async function assertTeaches(ownerId: string, opts: Opts, classroomId: string, subject: string, creating = false) {
  if (!opts.teacherId || (await teachesSubject(ownerId, opts.teacherId, classroomId, subject))) return;
  throw creating ? invalid("Yalnızca girdiğiniz derslere ödev verebilirsiniz.") : notFound("Ödev bulunamadı.");
}

/** Ödev formu (oluşturma/güncelleme) girdisini doğrular. Teslim tarihi günün sonu (23:59) kabul edilir. */
function parseHomework(body: Record<string, unknown>) {
  const subject = String(body.subject ?? "").trim();
  const title = String(body.title ?? "").trim();
  const dueDate = new Date(String(body.dueDate ?? "") + "T23:59:00");
  if (!subject || !title || isNaN(dueDate.getTime())) throw invalid("Ders, başlık ve teslim tarihi zorunludur.");
  return { subject, title, description: String(body.description ?? ""), dueDate };
}

/** Kurumun ödevi; yoksa / başka kurumunsa notFound("Ödev bulunamadı."). */
async function ownHomework(ownerId: string, id: string) {
  const hw = await prisma.homework.findFirst({ where: { id, ownerId } });
  if (!hw) throw notFound("Ödev bulunamadı.");
  return hw;
}

/** Kurumun tüm ödevleri (teslim tarihine göre yeniden eskiye), sınıf adı ve öğrenci durumlarıyla. */
export async function listHomework(ownerId: string) {
  return prisma.homework.findMany({
    where: { ownerId },
    orderBy: { dueDate: "desc" },
    include: { classroom: { select: { name: true } }, statuses: { select: { status: true } } },
  });
}

/** Kurumun ödevlerinde kullanılmış ders adları (tr sıralı). */
export async function homeworkSubjects(ownerId: string) {
  const rows = await prisma.homework.findMany({ where: { ownerId }, distinct: ["subject"], select: { subject: true } });
  return rows.map((r) => r.subject).sort((a, b) => a.localeCompare(b, "tr"));
}

/**
 * Ödev ayrıntısı: sınıfı ve öğrenci listesi (roster). Roster = sınıfın güncel öğrencileri +
 * sınıftan ayrılmış olsa da durum kaydı olan öğrenciler (ada göre); kaydı olmayan PENDING sayılır.
 * Yoksa / başka kurumunsa null.
 */
export async function findHomework(ownerId: string, id: string) {
  const hw = await prisma.homework.findFirst({ where: { id, ownerId }, include: { classroom: true, statuses: true } });
  if (!hw) return null;
  const inClass = await listStudents(ownerId, { inClass: hw.classroomId });
  const ids = [...new Set([...inClass.map((s) => s.id), ...hw.statuses.map((s) => s.studentId)])];
  const students = await listStudents(ownerId, { ids }, "name");
  const byStudent = new Map(hw.statuses.map((s) => [s.studentId, s]));
  const roster = students.map((student) => ({
    student,
    status: byStudent.get(student.id)?.status ?? "PENDING",
    note: byStudent.get(student.id)?.note ?? "",
  }));
  return { ...hw, roster };
}

/** Yeni ödev: sınıfın tüm öğrencileri (ek üyeler dahil) için PENDING durum kaydı oluşturur. */
export async function createHomework(ownerId: string, body: Record<string, unknown>, opts: Opts = {}) {
  const data = parseHomework(body);
  const classroom = await getClassroom(ownerId, String(body.classroomId ?? ""));
  await assertTeaches(ownerId, opts, classroom.id, data.subject, true);
  const students = await listStudents(ownerId, { inClass: classroom.id });
  const hw = await prisma.homework.create({
    data: {
      ownerId,
      classroomId: classroom.id,
      ...data,
      statuses: { create: students.map((s) => ({ studentId: s.id, status: "PENDING" })) },
    },
  });
  return { id: hw.id, students: students.length };
}

/** Ödevin ders/başlık/açıklama/teslim tarihini günceller. */
export async function updateHomework(ownerId: string, id: string, body: Record<string, unknown>) {
  const hw = await ownHomework(ownerId, id);
  const data = parseHomework(body);
  await prisma.homework.update({ where: { id: hw.id }, data });
}

export async function deleteHomework(ownerId: string, id: string) {
  const hw = await ownHomework(ownerId, id);
  await prisma.homework.delete({ where: { id: hw.id } });
}

export type StatusUpdate = { studentId: string; status?: string; note?: string };

/**
 * Öğrenci durumlarını günceller (tek ya da toplu). Başka kurumun öğrencileri ve
 * bilinmeyen durumlar sessizce atlanır; not 500 karakterle sınırlanır.
 */
export async function setHomeworkStatuses(ownerId: string, id: string, updates: unknown, opts: Opts = {}) {
  const hw = await ownHomework(ownerId, id);
  await assertTeaches(ownerId, opts, hw.classroomId, hw.subject);
  if (!Array.isArray(updates)) throw invalid("Geçersiz istek.");
  const list = updates as StatusUpdate[];
  const valid = new Set((await listStudents(ownerId, { ids: list.map((u) => u.studentId) })).map((s) => s.id));

  await prisma.$transaction(
    list
      .filter((u) => valid.has(u.studentId) && (u.status === undefined || u.status in HOMEWORK))
      .map((u) => {
        const data: { status?: string; note?: string } = {};
        if (u.status !== undefined) data.status = u.status;
        if (u.note !== undefined) data.note = String(u.note).slice(0, 500);
        return prisma.homeworkStatus.upsert({
          where: { homeworkId_studentId: { homeworkId: hw.id, studentId: u.studentId } },
          update: data,
          create: { homeworkId: hw.id, studentId: u.studentId, status: data.status ?? "PENDING", note: data.note ?? "" },
        });
      }),
  );
}

/** Öğrenci başına (kurumun ödevlerindeki) durum sayıları. `studentIds` verilirse yalnızca onlar. */
export async function homeworkCountsByStudent(ownerId: string, studentIds?: string[]) {
  const rows = await prisma.homeworkStatus.findMany({
    where: { homework: { ownerId }, ...(studentIds ? { studentId: { in: studentIds } } : {}) },
    select: { studentId: true, status: true },
  });
  const map = new Map<string, StatusCounts>();
  for (const r of rows) {
    let c = map.get(r.studentId);
    if (!c) map.set(r.studentId, (c = emptyCounts()));
    tally(c, r.status);
  }
  return map;
}

/** Bir öğrencinin (kurumun ödevlerindeki) durum kayıtları, ödeviyle; teslim tarihine göre yeniden eskiye. */
export async function studentHomework(ownerId: string, studentId: string) {
  return prisma.homeworkStatus.findMany({
    where: { studentId, homework: { ownerId } },
    include: { homework: true },
    orderBy: { homework: { dueDate: "desc" } },
  });
}

/**
 * Bir sınıfın bir dersindeki ödevler (teslimi `date`'ten 14 gün önce ile 21 gün sonrası arasında), durum sayılarıyla.
 * Öğretmenin ders ekranı için.
 */
export async function homeworkForLesson(ownerId: string, classroomId: string, subject: string, date: string) {
  const d = new Date(date + "T12:00:00");
  const from = new Date(d.getTime() - 14 * 86400000);
  const to = new Date(d.getTime() + 21 * 86400000);
  const list = await prisma.homework.findMany({
    where: { ownerId, classroomId, subject, dueDate: { gte: from, lte: to } },
    include: { statuses: { select: { status: true } } },
    orderBy: { dueDate: "desc" },
  });
  return list.map((h) => ({
    id: h.id, title: h.title, dueDate: h.dueDate,
    total: h.statuses.length, pending: h.statuses.filter((s) => s.status === "PENDING").length,
    done: h.statuses.filter((s) => s.status === "DONE").length,
  }));
}

/** Öğretmen ekranı için ödev: kendi dersi değilse null. */
export async function findHomeworkFor(ownerId: string, id: string, opts: Opts = {}) {
  const hw = await findHomework(ownerId, id);
  if (!hw) return null;
  if (opts.teacherId && !(await teachesSubject(ownerId, opts.teacherId, hw.classroomId, hw.subject))) return null;
  return hw;
}

/** Sınıf × ders ödev özeti (teslimi geçmiş ödevler, son `days` gün): ödev sayısı ve durum sayıları. */
export async function homeworkByClassSubject(ownerId: string, days = 60) {
  const now = new Date();
  const from = new Date(now.getTime() - days * 86400000);
  const list = await prisma.homework.findMany({
    where: { ownerId, dueDate: { gte: from, lt: now } },
    include: { classroom: { select: { id: true, name: true } }, statuses: { select: { status: true } } },
  });
  const rows = new Map<string, { classroomId: string; classroom: string; subject: string; count: number; counts: StatusCounts }>();
  for (const h of list) {
    const k = `${h.classroomId}|${h.subject}`;
    const r = rows.get(k) ?? { classroomId: h.classroomId, classroom: h.classroom.name, subject: h.subject, count: 0, counts: emptyCounts() };
    r.count++;
    for (const s of h.statuses) tally(r.counts, s.status);
    rows.set(k, r);
  }
  return [...rows.values()].sort((a, b) => a.classroom.localeCompare(b.classroom, "tr", { numeric: true }) || a.subject.localeCompare(b.subject, "tr"));
}
