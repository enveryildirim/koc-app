import { prisma } from "@/shared/db";

/** Takvim için: teslim tarihi aralıkta olan ödevler. `classroomId` verilirse yalnızca o sınıfınkiler. */
export async function homeworkDueBetween(ownerId: string, from: string, to: string, classroomId?: string) {
  return prisma.homework.findMany({
    where: {
      ownerId,
      dueDate: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") },
      ...(classroomId ? { classroomId } : {}),
    },
    select: { id: true, title: true, subject: true, dueDate: true, classroomId: true, classroom: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  });
}
