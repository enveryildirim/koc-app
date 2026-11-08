import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
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
 * Programa ders saati ekler. `dayOfWeeks: number[]` verilirse aynı saat seçilen her güne eklenir (yoksa `dayOfWeek`).
 * Ders sınıfta var olmalı (`parseSlot`); programdan ders açılmaz. Herhangi bir günde çakışma varsa hiçbiri kaydedilmez
 * (bkz. `assertNoClash`); yalnızca uyarı varsa `body.confirm === true` ile kaydedilir. Oluşan satırların kimlikleri döner.
 */
export async function createSlots(ownerId: string, body: Record<string, unknown>) {
  const days = Array.isArray(body.dayOfWeeks) ? [...new Set(body.dayOfWeeks.map(Number))].sort((a, b) => a - b) : [Number(body.dayOfWeek)];
  if (!days.length) throw invalid("En az bir gün seçin.");
  const list = await Promise.all(days.map((dayOfWeek) => parseSlot(ownerId, { ...body, dayOfWeek })));
  await assertNoClash(ownerId, list, { confirmed: body.confirm === true });
  const created = await prisma.$transaction(list.map((data) => prisma.scheduleSlot.create({ data: { ownerId, ...data } })));
  return created.map((c) => c.id);
}

type SlotKey = { classroomId: string; courseId: string | null; subject: string; teacherId: string; lessonType: string; startTime: string; endTime: string };

/**
 * Bir ders saatinin "serisi": aynı sınıf, ders, öğretmen, tür ve saatte başka günlerdeki satırlar (kendisi dahil).
 * Düzenleme penceresi günleri bu seriye göre gösterir; istemci de aynı kuralla hesaplar (`ScheduleBoard > sameSeries`).
 */
export async function slotSeries(ownerId: string, slot: SlotKey) {
  return prisma.scheduleSlot.findMany({
    where: {
      ownerId,
      classroomId: slot.classroomId,
      teacherId: slot.teacherId,
      lessonType: slot.lessonType,
      startTime: slot.startTime,
      endTime: slot.endTime,
      ...(slot.courseId ? { courseId: slot.courseId } : { subject: slot.subject }),
    },
    orderBy: [{ dayOfWeek: "asc" }],
  });
}

/**
 * Ders saatini düzenler. `dayOfWeeks[]` verilirse serinin tamamı yeniden yazılır (tek işlemde):
 * seçili günlerde satır varsa güncellenir, yoksa açılır (önce seçimden çıkan günlerin satırları yeniden kullanılır,
 * böylece geçmiş yoklamaların bağı korunur); kalan satırlar silinir. Bir günde kesin çakışma varsa hiçbir şey yazılmaz.
 * `dayOfWeeks` yoksa yalnızca bu satır güncellenir.
 */
export async function updateSlot(ownerId: string, id: string, body: Record<string, unknown>) {
  const slot = await ownedSlot(ownerId, id);
  if (!Array.isArray(body.dayOfWeeks)) {
    const data = await parseSlot(ownerId, body);
    await assertNoClash(ownerId, data, { excludeIds: [slot.id], confirmed: body.confirm === true });
    await prisma.scheduleSlot.update({ where: { id: slot.id }, data });
    return;
  }
  const days = [...new Set(body.dayOfWeeks.map(Number))].sort((a, b) => a - b);
  if (!days.length) throw invalid("En az bir gün seçin. Ders saatini kaldırmak için Sil'i kullanın.");
  const list = await Promise.all(days.map((dayOfWeek) => parseSlot(ownerId, { ...body, dayOfWeek })));
  const series = await slotSeries(ownerId, slot);
  await assertNoClash(ownerId, list, { excludeIds: series.map((x) => x.id), confirmed: body.confirm === true });

  // Gün başına mevcut satır (açılan satır kendi gününde önce gelir); kalanlar boşta
  const byDay = new Map<number, string>();
  for (const x of [slot, ...series.filter((x) => x.id !== slot.id)]) if (!byDay.has(x.dayOfWeek)) byDay.set(x.dayOfWeek, x.id);
  const kept = new Set(days.map((d) => byDay.get(d)).filter((x): x is string => !!x));
  const free = series.map((x) => x.id).filter((x) => !kept.has(x));
  const ops = list.map((data) => {
    const reuse = byDay.get(data.dayOfWeek) ?? free.shift();
    return reuse ? prisma.scheduleSlot.update({ where: { id: reuse }, data }) : prisma.scheduleSlot.create({ data: { ownerId, ...data } });
  });
  await prisma.$transaction([...ops, ...(free.length ? [prisma.scheduleSlot.deleteMany({ where: { ownerId, id: { in: free } } })] : [])]);
}

/** Programdan siler; geçmiş yoklamalar (LessonSession) korunur (slotId null olur). */
export async function deleteSlot(ownerId: string, id: string) {
  const slot = await ownedSlot(ownerId, id);
  await prisma.scheduleSlot.delete({ where: { id: slot.id } });
}
