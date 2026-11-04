import { prisma } from "@/shared/db";
import { notFound } from "@/shared/errors";
import { isBlankAnswer } from "../grading";

/**
 * Sınav sonuçları (kurum tarafı): katılımlar (en yeni önce) ve soru bazlı doğru/yanlış/boş sayıları.
 * Sahibi değilse null.
 */
export async function testResults(ownerId: string, id: string) {
  const test = await prisma.test.findFirst({
    where: { id, ownerId },
    include: {
      questions: { orderBy: { order: "asc" }, include: { answers: { select: { isCorrect: true, optionIds: true, text: true } } } },
      attempts: { orderBy: { finishedAt: "desc" } },
    },
  });
  if (!test) return null;
  const { questions, attempts, ...rest } = test;
  const total = attempts.length;
  const questionStats = questions.map((q) => {
    const correct = q.answers.filter((a) => a.isCorrect).length;
    const blank = total - q.answers.filter((a) => !isBlankAnswer(a)).length;
    return { text: q.text, correct, wrong: total - correct - blank, blank, rate: total ? Math.round((correct / total) * 100) : 0 };
  });
  return { test: rest, attempts, questionStats };
}

/** Kurumun sınavına ait bir katılımı siler. */
export async function deleteAttempt(ownerId: string, attemptId: string) {
  const attempt = await prisma.attempt.findFirst({ where: { id: attemptId, test: { ownerId } }, select: { id: true } });
  if (!attempt) throw notFound();
  await prisma.attempt.delete({ where: { id: attempt.id } });
}

