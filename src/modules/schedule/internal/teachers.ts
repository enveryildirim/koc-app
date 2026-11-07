import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { TEACHER_ROLE_KEYS } from "../labels";

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

/** Rol gönderilmezse `fallbackRole` kalır (düzenlemede mevcut rol korunur). */
function parseTeacher(body: Record<string, unknown>, fallbackRole = "TEACHER") {
  const name = String(body.name ?? "").trim();
  const branch = String(body.branch ?? "").trim();
  const role = String(body.role ?? fallbackRole);
  if (!name || !branch) throw invalid("Ad ve branş gerekli.");
  if (!TEACHER_ROLE_KEYS.includes(role)) throw invalid("Geçersiz rol.");
  return { name, branch, role };
}

export async function createTeacher(ownerId: string, body: Record<string, unknown>) {
  return prisma.teacher.create({ data: { ownerId, ...parseTeacher(body) } });
}

export async function updateTeacher(ownerId: string, id: string, body: Record<string, unknown>) {
  const t = await ownedTeacher(ownerId, id);
  await prisma.teacher.update({ where: { id: t.id }, data: parseTeacher(body, t.role) });
}

/** Öğretmeni siler; programdaki dersleri ve geçmiş ders oturumları da silinir (cascade). */
export async function deleteTeacher(ownerId: string, id: string) {
  const t = await ownedTeacher(ownerId, id);
  await prisma.teacher.delete({ where: { id: t.id } });
}

/** Öğretmen (sayfa için); yoksa veya başka kurumunsa null. */
export async function findTeacher(ownerId: string, id: string) {
  return prisma.teacher.findFirst({ where: { id, ownerId } });
}
