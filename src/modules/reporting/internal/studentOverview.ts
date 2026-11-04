/** Öğrenci sayfası: bir öğrencinin tüm deneme, ödev ve devam kayıtları. */
import { prisma } from "@/shared/db";
import { attendanceSummary, homeworkSummary } from "./summary";

/**
 * Kurumun öğrencisinin deneme sonuçları (tarih sırasıyla), ödevleri (yeniden eskiye)
 * ve yoklamaları (devamsızlıklar yeniden eskiye). Başka kurumun öğrencisi için kayıt dönmez.
 */
export async function studentOverview(ownerId: string, studentId: string) {
  const own = { studentId, student: { ownerId } };
  const [results, homeworks, attendances] = await Promise.all([
    prisma.examResult.findMany({ where: own, include: { exam: true }, orderBy: { exam: { date: "asc" } } }),
    prisma.homeworkStatus.findMany({ where: own, include: { homework: true }, orderBy: { homework: { dueDate: "desc" } } }),
    prisma.attendance.findMany({ where: own, include: { session: true } }),
  ]);
  return {
    results,
    homework: { ...homeworkSummary(homeworks), list: homeworks },
    attendance: {
      ...attendanceSummary(attendances),
      absences: attendances.filter((a) => a.status !== "PRESENT").sort((a, b) => b.session.date.localeCompare(a.session.date)),
    },
  };
}
