import { prisma } from "@/shared/db";
import { AppError, invalid } from "@/shared/errors";
import { getClassroom } from "@/modules/enrollment/server";
import { LESSON_TYPE_KEYS } from "../labels";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type SlotInput = {
  classroomId: string;
  teacherId: string;
  subject: string;
  lessonType: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

/**
 * Ders (program kaydı) gövdesini doğrular; sınıf ve öğretmenin aynı kuruma ait olmasını kontrol eder.
 * Geçersizse `invalid` (400) fırlatır.
 */
export async function parseSlot(ownerId: string, body: Record<string, unknown>): Promise<SlotInput> {
  const classroomId = String(body.classroomId ?? "");
  const teacherId = String(body.teacherId ?? "");
  const subject = String(body.subject ?? "").trim();
  const lessonType = String(body.lessonType ?? "GRUP");
  const dayOfWeek = Number(body.dayOfWeek);
  const startTime = String(body.startTime ?? "");
  const endTime = String(body.endTime ?? "");
  if (!subject) throw invalid("Ders adı gerekli.");
  if (!LESSON_TYPE_KEYS.includes(lessonType)) throw invalid("Geçersiz ders türü.");
  if (!(dayOfWeek >= 1 && dayOfWeek <= 7)) throw invalid("Geçersiz gün.");
  if (!TIME.test(startTime) || !TIME.test(endTime) || startTime >= endTime) throw invalid("Başlangıç saati bitişten önce olmalı (SS:DD).");
  const [cls, teacher] = await Promise.all([
    getClassroom(ownerId, classroomId).catch((e) => {
      if (e instanceof AppError && e.kind === "not_found") return null;
      throw e;
    }),
    prisma.teacher.findFirst({ where: { id: teacherId, ownerId }, select: { id: true } }),
  ]);
  if (!cls) throw invalid("Sınıf bulunamadı.");
  if (!teacher) throw invalid("Öğretmen bulunamadı.");
  return { classroomId, teacherId, subject, lessonType, dayOfWeek, startTime, endTime };
}
