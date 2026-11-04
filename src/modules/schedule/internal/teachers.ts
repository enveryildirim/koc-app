import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";

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

function parseTeacher(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const branch = String(body.branch ?? "").trim();
  if (!name || !branch) throw invalid("Ad ve branş gerekli.");
  return { name, branch };
}

export async function createTeacher(ownerId: string, body: Record<string, unknown>) {
  return prisma.teacher.create({ data: { ownerId, ...parseTeacher(body) } });
}

export async function updateTeacher(ownerId: string, id: string, body: Record<string, unknown>) {
  const t = await ownedTeacher(ownerId, id);
  await prisma.teacher.update({ where: { id: t.id }, data: parseTeacher(body) });
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
