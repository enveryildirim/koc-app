import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { TEACHER_ROLE_KEYS } from "../labels";
import { revokeAccessLink, syncAccessLink } from "@/modules/identity/server";

/** Kurumun öğretmenleri (ada göre), her biri programdaki haftalık ders sayısıyla. */
export async function listTeachers(ownerId: string) {
  const list = await prisma.teacher.findMany({
    where: { ownerId },
    orderBy: { name: "asc" },
    include: { _count: { select: { slots: true } } },
  });
  return list.map(({ _count, ...t }) => ({ ...t, slotCount: _count.slots }));
}

async function ownedTeacher(ownerId: string, id: string) {
  const t = await prisma.teacher.findFirst({ where: { id, ownerId } });
  if (!t) throw notFound();
  return t;
}

/**
 * Rol gönderilmezse `fallbackRole` kalır (düzenlemede mevcut rol korunur).
 * Etüt mesulünün branşı yoktur: boş kaydedilir. Öğretmende branş zorunludur.
 */
function parseTeacher(body: Record<string, unknown>, fallbackRole = "TEACHER") {
  const name = String(body.name ?? "").trim();
  const role = String(body.role ?? fallbackRole);
  if (!name) throw invalid("Ad soyad gerekli.");
  if (!TEACHER_ROLE_KEYS.includes(role)) throw invalid("Geçersiz rol.");
  const branch = role === "MENTOR" ? "" : String(body.branch ?? "").trim();
  if (role !== "MENTOR" && !branch) throw invalid("Öğretmenin branşı gerekli.");
  return { name, branch, role };
}

export async function createTeacher(ownerId: string, body: Record<string, unknown>) {
  return prisma.teacher.create({ data: { ownerId, ...parseTeacher(body) } });
}

export async function updateTeacher(ownerId: string, id: string, body: Record<string, unknown>) {
  const t = await ownedTeacher(ownerId, id);
  const data = parseTeacher(body, t.role);
  await prisma.teacher.update({ where: { id: t.id }, data });
  await syncAccessLink(ownerId, { id: t.id, name: data.name, role: data.role });
}

/** Öğretmeni siler; programdaki dersleri ve geçmiş ders oturumları da silinir (cascade). */
export async function deleteTeacher(ownerId: string, id: string) {
  const t = await ownedTeacher(ownerId, id);
  await prisma.teacher.delete({ where: { id: t.id } });
  await revokeAccessLink(ownerId, t.id);
}

/** Öğretmen (sayfa için); yoksa veya başka kurumunsa null. */
export async function findTeacher(ownerId: string, id: string) {
  return prisma.teacher.findFirst({ where: { id, ownerId } });
}

/**
 * Öğretmen bu sınıfın bu dersine giriyor mu: programda satırı var ya da dersin sorumlusu.
 * Öğretmen oturumunda yoklama ve işlenen konu yazmadan önce denetlenir.
 */
export async function teachesSubject(ownerId: string, teacherId: string, classroomId: string, subject: string) {
  const [slot, course] = await Promise.all([
    prisma.scheduleSlot.findFirst({ where: { ownerId, teacherId, classroomId, subject }, select: { id: true } }),
    prisma.course.findFirst({ where: { ownerId, teacherId, classroomId, name: subject }, select: { id: true } }),
  ]);
  return !!(slot || course);
}
