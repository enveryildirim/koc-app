import { prisma } from "@/shared/db";
import { notFound } from "@/shared/errors";
import { parseSlot } from "./validate";
import { courseIdFor } from "./courses";

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

/** Programa ders ekler; sınıfın aynı adlı dersine bağlanır (yoksa ders oluşturulur). */
export async function createSlot(ownerId: string, body: Record<string, unknown>) {
  const data = await parseSlot(ownerId, body);
  const courseId = await courseIdFor(ownerId, data);
  return prisma.scheduleSlot.create({ data: { ownerId, ...data, courseId } });
}

export async function updateSlot(ownerId: string, id: string, body: Record<string, unknown>) {
  const slot = await ownedSlot(ownerId, id);
  const data = await parseSlot(ownerId, body);
  const courseId = await courseIdFor(ownerId, data);
  await prisma.scheduleSlot.update({ where: { id: slot.id }, data: { ...data, courseId } });
}

/** Programdan siler; geçmiş yoklamalar (LessonSession) korunur (slotId null olur). */
export async function deleteSlot(ownerId: string, id: string) {
  const slot = await ownedSlot(ownerId, id);
  await prisma.scheduleSlot.delete({ where: { id: slot.id } });
}
