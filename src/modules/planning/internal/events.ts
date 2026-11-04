import { prisma } from "@/shared/db";
import { conflict, invalid, notFound } from "@/shared/errors";
import { getClassroom } from "@/modules/enrollment/server";
import { EVENT_KINDS, nationalHolidays, YMD } from "../calendar";

export type DateRange = { from: string; to: string };

/** Aralıkla kesişen etkinlikler. `classroomId` verilirse kurum geneli + o sınıfınkiler. */
export async function listEvents(ownerId: string, range: DateRange, classroomId?: string) {
  return prisma.calendarEvent.findMany({
    where: {
      ownerId,
      startDate: { lte: range.to },
      endDate: { gte: range.from },
      ...(classroomId ? { OR: [{ classroomId: null }, { classroomId }] } : {}),
    },
    include: { classroom: { select: { name: true } } },
    orderBy: [{ startDate: "asc" }, { title: "asc" }],
  });
}

/** Verilen günü kapsayan tatiller (kurum geneli ve sınıf bazlı). */
export async function holidaysOn(ownerId: string, date: string) {
  return prisma.calendarEvent.findMany({
    where: { ownerId, kind: "HOLIDAY", startDate: { lte: date }, endDate: { gte: date } },
    include: { classroom: { select: { name: true } } },
  });
}

async function parseEvent(ownerId: string, body: Record<string, unknown>) {
  const title = String(body.title ?? "").trim();
  const kind = String(body.kind ?? "EVENT");
  const startDate = String(body.startDate ?? "");
  const endDate = String(body.endDate || startDate);
  const classroomId = body.classroomId ? String(body.classroomId) : null;
  if (!title) throw invalid("Başlık gerekli.");
  if (!EVENT_KINDS[kind]) throw invalid("Geçersiz etkinlik türü.");
  if (!YMD.test(startDate) || !YMD.test(endDate)) throw invalid("Geçerli bir tarih girin.");
  if (endDate < startDate) throw invalid("Bitiş tarihi başlangıçtan önce olamaz.");
  if (classroomId) {
    try {
      await getClassroom(ownerId, classroomId);
    } catch {
      throw invalid("Sınıf bulunamadı.");
    }
  }
  return { title, kind, startDate, endDate, classroomId, note: String(body.note ?? "").trim() };
}

async function ownedEvent(ownerId: string, id: string) {
  const e = await prisma.calendarEvent.findFirst({ where: { id, ownerId } });
  if (!e) throw notFound("Etkinlik bulunamadı.");
  return e;
}

export async function createEvent(ownerId: string, body: Record<string, unknown>) {
  return prisma.calendarEvent.create({ data: { ownerId, ...(await parseEvent(ownerId, body)) } });
}

export async function updateEvent(ownerId: string, id: string, body: Record<string, unknown>) {
  const e = await ownedEvent(ownerId, id);
  await prisma.calendarEvent.update({ where: { id: e.id }, data: await parseEvent(ownerId, body) });
}

export async function deleteEvent(ownerId: string, id: string) {
  const e = await ownedEvent(ownerId, id);
  await prisma.calendarEvent.delete({ where: { id: e.id } });
}

/** Eğitim yılının sabit tarihli resmî tatillerini ekler; aynı gün aynı adla zaten varsa atlar. */
export async function addNationalHolidays(ownerId: string, year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw invalid("Geçersiz eğitim yılı.");
  const list = nationalHolidays(year);
  const existing = await prisma.calendarEvent.findMany({
    where: { ownerId, kind: "HOLIDAY", classroomId: null, startDate: { in: list.map((h) => h.date) } },
    select: { startDate: true, title: true },
  });
  const has = new Set(existing.map((e) => `${e.startDate}|${e.title}`));
  const todo = list.filter((h) => !has.has(`${h.date}|${h.title}`));
  if (!todo.length) throw conflict("Bu eğitim yılının resmî tatilleri zaten ekli.");
  await prisma.calendarEvent.createMany({
    data: todo.map((h) => ({ ownerId, kind: "HOLIDAY", title: h.title, startDate: h.date, endDate: h.date })),
  });
  return { added: todo.length };
}
