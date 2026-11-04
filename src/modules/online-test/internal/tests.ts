import { prisma } from "@/shared/db";
import { notFound } from "@/shared/errors";
import { pct, shareCode } from "../grading";

/*
 * Kurum (sınav sahibi) tarafı: her fonksiyon ownerId alır ve sahipliği kendisi denetler.
 * Sorgular başka kurumun / olmayan sınav için null döndürür (sayfa notFound() çağırır);
 * değişiklikler AppError("not_found") fırlatır.
 */

const withQuestions = {
  questions: { orderBy: { order: "asc" as const }, include: { options: { orderBy: { order: "asc" as const } } } },
};

/** Sınavın kendisi (başlık, paylaşım kodu, ayarlar); sahibi değilse null. */
export async function findTest(ownerId: string, id: string) {
  return prisma.test.findFirst({ where: { id, ownerId } });
}

/** Sahipliği doğrular; değilse not_found fırlatır. */
async function ownedTestId(ownerId: string, id: string) {
  const t = await prisma.test.findFirst({ where: { id, ownerId }, select: { id: true } });
  if (!t) throw notFound();
  return t.id;
}

/** Kurumun sınavları, en yeni önce; soru/katılım sayısı ve ortalama başarı yüzdesiyle. */
export async function listTests(ownerId: string) {
  const tests = await prisma.test.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: true } },
      attempts: { select: { score: true, maxScore: true } },
    },
  });
  return tests.map(({ attempts, _count, ...t }) => ({
    ...t,
    questionCount: _count.questions,
    attemptCount: attempts.length,
    /** Katılımların ortalama yüzdesi; katılım yoksa null. */
    avgPercent: attempts.length
      ? Math.round(attempts.reduce((s, a) => s + pct(a.score, a.maxScore), 0) / attempts.length)
      : null,
  }));
}

/** Tek boş sorulu taslak sınav oluşturur. */
export async function createTest(ownerId: string) {
  const test = await prisma.test.create({
    data: {
      ownerId,
      title: "Yeni sınav",
      shareCode: shareCode(),
      isPublished: false,
      questions: {
        create: {
          order: 0,
          type: "SINGLE",
          text: "",
          options: { create: [0, 1, 2, 3].map((order) => ({ order, text: "", isCorrect: order === 0 })) },
        },
      },
    },
  });
  return { id: test.id };
}

/** Düzenleyici için sınav: sorular ve şıklar (cevap anahtarı dahil), sıralı. Sahibi değilse null. */
export async function testWithQuestions(ownerId: string, id: string) {
  return prisma.test.findFirst({ where: { id, ownerId }, include: withQuestions });
}

type OptionIn = { id?: string; text: string; isCorrect: boolean };
type QuestionIn = {
  id?: string;
  type: string;
  text: string;
  points: number;
  correctText: string;
  explanation: string;
  options: OptionIn[];
};

/**
 * Düzenleyiciden gelen sınavı kaydeder. Var olan soru/şıklar güncellenir (eski katılımların
 * cevapları bozulmaz), gönderilmeyenler silinir. Kaydedilen soru/şık kimliklerini döndürür.
 */
export async function saveTest(ownerId: string, id: string, body: Record<string, unknown>) {
  const testId = await ownedTestId(ownerId, id);
  const questions = (body.questions ?? []) as QuestionIn[];

  await prisma.$transaction(async (tx) => {
    await tx.test.update({
      where: { id: testId },
      data: {
        title: String(body.title ?? "").trim() || "Adsız sınav",
        description: String(body.description ?? ""),
        timeLimitMin: body.timeLimitMin ? Math.max(1, Number(body.timeLimitMin)) : null,
        passPercent: Math.min(100, Math.max(0, Number(body.passPercent ?? 50))),
        shuffleQuestions: !!body.shuffleQuestions,
        showAnswers: !!body.showAnswers,
        isPublished: !!body.isPublished,
      },
    });

    const existing = await tx.question.findMany({ where: { testId }, select: { id: true } });
    const keep = new Set(questions.map((q) => q.id).filter(Boolean));
    await tx.question.deleteMany({ where: { id: { in: existing.filter((q) => !keep.has(q.id)).map((q) => q.id) } } });

    for (const [order, q] of questions.entries()) {
      const isChoice = q.type !== "SHORT";
      const data = {
        order,
        type: q.type,
        text: q.text,
        points: Math.max(1, Number(q.points) || 1),
        correctText: q.correctText ?? "",
        explanation: q.explanation ?? "",
      };
      const saved = q.id && existing.some((e) => e.id === q.id)
        ? await tx.question.update({ where: { id: q.id }, data })
        : await tx.question.create({ data: { ...data, testId } });

      const opts = isChoice ? q.options : [];
      const oldOpts = await tx.option.findMany({ where: { questionId: saved.id }, select: { id: true } });
      const keepO = new Set(opts.map((o) => o.id).filter(Boolean));
      await tx.option.deleteMany({ where: { id: { in: oldOpts.filter((o) => !keepO.has(o.id)).map((o) => o.id) } } });
      for (const [k, o] of opts.entries()) {
        const od = { order: k, text: o.text, isCorrect: !!o.isCorrect };
        if (o.id && oldOpts.some((x) => x.id === o.id)) await tx.option.update({ where: { id: o.id }, data: od });
        else await tx.option.create({ data: { ...od, questionId: saved.id } });
      }
    }
  });

  const saved = await prisma.question.findMany({
    where: { testId },
    orderBy: { order: "asc" },
    select: { id: true, options: { orderBy: { order: "asc" }, select: { id: true } } },
  });
  return { questions: saved };
}

/** Sınavı (soruları ve katılımlarıyla birlikte) siler. */
export async function deleteTest(ownerId: string, id: string) {
  await prisma.test.delete({ where: { id: await ownedTestId(ownerId, id) } });
}
