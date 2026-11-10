import { prisma } from "@/shared/db";

/** Öğrenci → ana sınıfı (sınıfı olmayan öğrenci listede yok). exams: havuz sorusunu hangi sınıfın gördüğünü bulmak için. */
export async function studentHomeClassrooms(ownerId: string) {
  const rows = await prisma.student.findMany({ where: { ownerId, classroomId: { not: null } }, select: { id: true, classroomId: true } });
  return new Map(rows.map((r) => [r.id, r.classroomId!]));
}
