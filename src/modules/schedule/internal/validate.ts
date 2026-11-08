import { prisma } from "@/shared/db";
import { AppError, invalid } from "@/shared/errors";
import { getClassroom } from "@/modules/enrollment/server";
import { LESSON_TYPE_KEYS } from "../labels";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type SlotInput = {
  classroomId: string;
  teacherId: string;
  /** Sınıfın dersi (Course). Program satırı ve ek ders yalnızca var olan bir derse bağlanır; ders Yönetim → Dersler'de açılır. */
  courseId: string;
  /** Dersin adı (courseId'den) */
  subject: string;
  lessonType: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

/**
 * Ders (program kaydı) gövdesini doğrular; sınıf, öğretmen ve dersin aynı kuruma ait olmasını kontrol eder.
 * Ders `courseId` ile (ya da eski istemciler için `subject` adıyla) seçilir ve sınıfta var olmalıdır:
 * programdan ders açılmaz. Geçersizse `invalid` (400) fırlatır.
 */
export async function parseSlot(ownerId: string, body: Record<string, unknown>): Promise<SlotInput> {
  const classroomId = String(body.classroomId ?? "");
  const teacherId = String(body.teacherId ?? "");
  const courseId = String(body.courseId ?? "");
  const subjectName = String(body.subject ?? "").trim();
  const lessonType = String(body.lessonType ?? "GRUP");
  const dayOfWeek = Number(body.dayOfWeek);
  const startTime = String(body.startTime ?? "");
  const endTime = String(body.endTime ?? "");
  if (!courseId && !subjectName) throw invalid("Ders seçin.");
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
  const course = await prisma.course.findFirst({
    where: { ownerId, classroomId, ...(courseId ? { id: courseId } : { name: subjectName }) },
    select: { id: true, name: true },
  });
  if (!course) {
    throw invalid(
      courseId
        ? "Ders bu sınıfta bulunamadı."
        : `${cls.name} sınıfında “${subjectName}” dersi yok. Önce Yönetim → Dersler sayfasından ekleyin.`,
    );
  }
  return { classroomId, teacherId, courseId: course.id, subject: course.name, lessonType, dayOfWeek, startTime, endTime };
}
