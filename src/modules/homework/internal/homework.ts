import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { getClassroom, listStudents } from "@/modules/enrollment/server";
import { HOMEWORK, emptyCounts, tally, type StatusCounts } from "../labels";

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
  const inClass = await listStudents(ownerId, { classroomId: hw.classroomId });
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

/** Yeni ödev: sınıfın tüm öğrencileri için PENDING durum kaydı oluşturur. */
export async function createHomework(ownerId: string, body: Record<string, unknown>) {
  const data = parseHomework(body);
  const classroom = await getClassroom(ownerId, String(body.classroomId ?? ""));
  const students = await listStudents(ownerId, { classroomId: classroom.id });
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
export async function setHomeworkStatuses(ownerId: string, id: string, updates: unknown) {
  const hw = await ownHomework(ownerId, id);
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
