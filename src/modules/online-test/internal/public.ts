import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { gradeAll, isBlankAnswer, type SubmittedAnswer } from "../grading";

/*
 * Herkese açık akışlar (giriş gerektirmez): paylaşım koduyla sınav çözme ve sonuç sayfası.
 * Bu fonksiyonlar ownerId almaz; cevap anahtarını yalnızca izin verilen durumda döndürür.
 */

/**
 * Paylaşım koduyla yayındaki sınav, çözen kişiye gösterilecek biçimde: doğru şıklar,
 * kısa cevap anahtarı ve açıklamalar YOKTUR. Sınav ayarına göre sorular karıştırılır.
 * Bulunamazsa veya yayında değilse null.
 */
export async function publicTestByCode(code: string) {
  const t = await prisma.test.findUnique({
    where: { shareCode: code.toUpperCase() },
    include: { questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } } },
  });
  if (!t || !t.isPublished) return null;

  let questions = t.questions;
  if (t.shuffleQuestions) questions = [...questions].sort(() => Math.random() - 0.5);

  return {
    code: t.shareCode,
    title: t.title,
    description: t.description,
    timeLimitMin: t.timeLimitMin,
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      points: q.points,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    })),
  };
}

/** Katılımcının paylaşım koduyla gönderdiği cevapları puanlayıp kaydeder; katılım kimliğini döndürür. */
export async function submitPublicAttempt(code: string, body: Record<string, unknown>) {
  const test = await prisma.test.findUnique({
    where: { shareCode: code },
    include: { questions: { include: { options: true } } },
  });
  if (!test || !test.isPublished) throw notFound("Sınav bulunamadı.");

  const name = String(body.name ?? "").trim();
  if (!name) throw invalid("Ad soyad gerekli.");
  const answers = (body.answers ?? {}) as Record<string, SubmittedAnswer>;
  const { score, maxScore, rows } = gradeAll(test.questions, answers);
  const startedAt = body.startedAt ? new Date(body.startedAt as string | number) : new Date();

  const attempt = await prisma.attempt.create({
    data: {
      testId: test.id,
      participantName: name,
      studentNo: String(body.studentNo ?? ""),
      startedAt: isNaN(startedAt.getTime()) ? new Date() : startedAt,
      finishedAt: new Date(),
      score,
      maxScore,
      answers: { create: rows },
    },
  });
  return { id: attempt.id };
}

/**
 * Bir katılımın sonuç sayfası (giriş gerektirmez; bağlantıyı bilen görür).
 * `viewerId` oturumdaki kullanıcıdır (yoksa null). Cevap anahtarı (`answerKey`) yalnızca
 * sınavda "cevapları göster" açıksa veya bakan kişi sınavın sahibiyse döner; aksi halde null.
 */
export async function publicAttemptResult(attemptId: string, viewerId: string | null) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
      test: { include: { questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } } } },
    },
  });
  if (!attempt) return null;
  const { test, answers } = attempt;
  const isOwner = viewerId !== null && viewerId === test.ownerId;

  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  let correct = 0, wrong = 0, blank = 0;
  for (const q of test.questions) {
    const a = byQ.get(q.id);
    if (isBlankAnswer(a)) blank++;
    else if (a!.isCorrect) correct++;
    else wrong++;
  }

  return {
    isOwner,
    test: { id: test.id, title: test.title, passPercent: test.passPercent },
    participantName: attempt.participantName,
    studentNo: attempt.studentNo,
    source: attempt.source,
    finishedAt: attempt.finishedAt,
    score: attempt.score,
    maxScore: attempt.maxScore,
    counts: { correct, wrong, blank },
    answerKey: test.showAnswers || isOwner ? { questions: test.questions, answers } : null,
  };
}
