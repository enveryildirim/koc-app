import { prisma } from "@/shared/db";
import { conflict, invalid, notFound } from "@/shared/errors";

/** Sınıf adları kurum içinde büyük harfe normalize edilerek tutulur. */
export const normClassName = (name: unknown) => String(name ?? "").trim().toLocaleUpperCase("tr-TR");

/** Kurumun sınıfları (ada göre), her biri kayıtlı öğrenci sayısıyla. */
export async function classroomsOf(ownerId: string) {
  const list = await prisma.classroom.findMany({
    where: { ownerId },
    orderBy: { name: "asc" },
    include: { _count: { select: { students: true } } },
  });
  return list.map(({ _count, ...c }) => ({ ...c, studentCount: _count.students }));
}

/** Kurumun sınıfını getirir; yoksa / başka kurumunsa notFound. */
export async function getClassroom(ownerId: string, id: string) {
  const c = await prisma.classroom.findFirst({ where: { id, ownerId } });
  if (!c) throw notFound("Sınıf bulunamadı.");
  return c;
}

/** Yeni sınıf; ad zorunlu ve kurum içinde benzersiz. */
export async function createClassroom(ownerId: string, body: Record<string, unknown>) {
  const name = normClassName(body.name);
  if (!name) throw invalid("Sınıf adı gerekli.");
  if (await prisma.classroom.findUnique({ where: { ownerId_name: { ownerId, name } } })) {
    throw conflict("Bu isimde bir sınıf zaten var.");
  }
  return prisma.classroom.create({ data: { ownerId, name, level: String(body.level ?? "").trim() } });
}

/** Sınıfı siler; öğrencisi olan sınıf silinemez. */
export async function deleteClassroom(ownerId: string, id: string) {
  const c = await prisma.classroom.findFirst({ where: { id, ownerId }, include: { _count: { select: { students: true } } } });
  if (!c) throw notFound();
  if (c._count.students > 0) throw conflict("Sınıfta öğrenci var. Önce öğrencileri başka sınıfa taşıyın.");
  await prisma.classroom.delete({ where: { id } });
}
