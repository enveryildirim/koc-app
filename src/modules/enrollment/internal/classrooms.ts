import { prisma } from "@/shared/db";

export async function classroomsOf(ownerId: string) {
  return prisma.classroom.findMany({ where: { ownerId }, orderBy: { name: "asc" } });
}
