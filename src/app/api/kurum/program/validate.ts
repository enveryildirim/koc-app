import { prisma } from "@/lib/db";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const LESSON_TYPE_KEYS = ["GRUP", "ETUT", "OZEL"];

/** Ders (program kaydı) gövdesini doğrular; sınıf ve öğretmenin aynı kuruma ait olmasını kontrol eder. */
export async function parseSlot(ownerId: string, body: Record<string, unknown>) {
  const classroomId = String(body.classroomId ?? "");
  const teacherId = String(body.teacherId ?? "");
  const subject = String(body.subject ?? "").trim();
  const lessonType = String(body.lessonType ?? "GRUP");
  const dayOfWeek = Number(body.dayOfWeek);
  const startTime = String(body.startTime ?? "");
  const endTime = String(body.endTime ?? "");
  if (!subject) return { error: "Ders adı gerekli." };
  if (!LESSON_TYPE_KEYS.includes(lessonType)) return { error: "Geçersiz ders türü." };
  if (!(dayOfWeek >= 1 && dayOfWeek <= 7)) return { error: "Geçersiz gün." };
  if (!TIME.test(startTime) || !TIME.test(endTime) || startTime >= endTime) return { error: "Başlangıç saati bitişten önce olmalı (SS:DD)." };
  const [cls, teacher] = await Promise.all([
    prisma.classroom.findUnique({ where: { id: classroomId } }),
    prisma.teacher.findUnique({ where: { id: teacherId } }),
  ]);
  if (!cls || cls.ownerId !== ownerId) return { error: "Sınıf bulunamadı." };
  if (!teacher || teacher.ownerId !== ownerId) return { error: "Öğretmen bulunamadı." };
  return { data: { classroomId, teacherId, subject, lessonType, dayOfWeek, startTime, endTime } };
}
