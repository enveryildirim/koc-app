import { prisma } from "@/shared/db";

/** Kurumdaki her öğrencinin girdiği deneme sayısı (studentId → adet). Öğrenci listesi için. */
export async function resultCountsByStudent(ownerId: string) {
  const rows = await prisma.examResult.groupBy({ by: ["studentId"], where: { student: { ownerId } }, _count: true });
  return new Map(rows.map((r) => [r.studentId, r._count]));
}
