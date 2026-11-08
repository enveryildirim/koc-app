import { prisma } from "@/shared/db";
import { notFound } from "@/shared/errors";
import { parseSlot } from "./validate";
import { assertNoClash } from "./clashes";

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

/**
 * Programa ders ekler. Ders sınıfta var olmalı (`parseSlot`); programdan ders açılmaz.
 * Çakışma varsa kaydetmez (bkz. `assertNoClash`); yalnızca uyarı varsa `body.confirm === true` ile kaydedilir.
 */
export async function createSlot(ownerId: string, body: Record<string, unknown>) {
  const data = await parseSlot(ownerId, body);
  await assertNoClash(ownerId, data, { confirmed: body.confirm === true });
  return prisma.scheduleSlot.create({ data: { ownerId, ...data } });
}

export async function updateSlot(ownerId: string, id: string, body: Record<string, unknown>) {
  const slot = await ownedSlot(ownerId, id);
  const data = await parseSlot(ownerId, body);
  await assertNoClash(ownerId, data, { selfId: slot.id, confirmed: body.confirm === true });
  await prisma.scheduleSlot.update({ where: { id: slot.id }, data });
}

/** Programdan siler; geçmiş yoklamalar (LessonSession) korunur (slotId null olur). */
export async function deleteSlot(ownerId: string, id: string) {
  const slot = await ownedSlot(ownerId, id);
  await prisma.scheduleSlot.delete({ where: { id: slot.id } });
}
