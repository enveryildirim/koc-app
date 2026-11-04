import { prisma } from "@/shared/db";
import { notFound } from "@/shared/errors";
import { parseSlot } from "./validate";

export type SlotFilter = { classroomId?: string; teacherId?: string; dayOfWeek?: number };

/** Programdaki haftalık dersler (sınıf ve öğretmeniyle), gün ve saate göre. */
export async function listSlots(ownerId: string, f: SlotFilter = {}) {
  return prisma.scheduleSlot.findMany({
    where: { ownerId, ...f },
    include: { classroom: true, teacher: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
}

async function ownedSlot(ownerId: string, id: string) {
  const slot = await prisma.scheduleSlot.findFirst({ where: { id, ownerId } });
  if (!slot) throw notFound();
  return slot;
}

export async function createSlot(ownerId: string, body: Record<string, unknown>) {
  const data = await parseSlot(ownerId, body);
  return prisma.scheduleSlot.create({ data: { ownerId, ...data } });
}

export async function updateSlot(ownerId: string, id: string, body: Record<string, unknown>) {
  const slot = await ownedSlot(ownerId, id);
  const data = await parseSlot(ownerId, body);
  await prisma.scheduleSlot.update({ where: { id: slot.id }, data });
}

/** Programdan siler; geçmiş yoklamalar (LessonSession) korunur (slotId null olur). */
export async function deleteSlot(ownerId: string, id: string) {
  const slot = await ownedSlot(ownerId, id);
  await prisma.scheduleSlot.delete({ where: { id: slot.id } });
}
