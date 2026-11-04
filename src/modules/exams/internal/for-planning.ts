import { prisma } from "@/shared/db";

/** Takvim için: tarihi aralıkta olan denemeler (YYYY-MM-DD, iki uç dahil). */
export async function examsBetween(ownerId: string, from: string, to: string) {
  return prisma.exam.findMany({
    where: { ownerId, date: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") } },
    select: { id: true, name: true, type: true, date: true },
    orderBy: { date: "asc" },
  });
}
