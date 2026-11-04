import { prisma } from "@/shared/db";
import { notFound } from "@/shared/errors";
import { choiceCountFor, MAX_QUESTIONS } from "@/shared/omr/layout";
import { gradeAll, type SubmittedAnswer } from "../grading";

async function questionsOf(testId: string) {
  return prisma.question.findMany({
    where: { testId },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } } },
  });
}

/**
 * Sınavın optik form bilgileri: formdaki sorular ve cevap anahtarı. Sahibi değilse null.
 * Formda yalnızca şıklı (tek cevaplı / doğru-yanlış) sorular yer alır; `skipped` dışarıda kalanların sayısıdır.
 */
export async function omrForm(ownerId: string, testId: string) {
  const test = await prisma.test.findFirst({ where: { id: testId, ownerId }, select: { id: true, title: true } });
  if (!test) return null;
  const questions = await questionsOf(test.id);
  const eligible = questions.filter((q) => choiceCountFor(q) > 0);
  const onForm = eligible.slice(0, MAX_QUESTIONS);
  return {
    info: { title: test.title, brand: "SınavKur", questions: onForm.map((q) => ({ choiceCount: choiceCountFor(q) })) },
    key: onForm.map((q) => ({
      points: q.points,
      correct: q.options.slice(0, choiceCountFor(q)).flatMap((o, k) => (o.isCorrect ? [k] : [])),
      number: questions.indexOf(q) + 1,
    })),
    skipped: questions.length - onForm.length,
  };
}

/** Taranmış optik form: answers[i] = formdaki i. sorunun işaretli şık indeksleri. */
export type OmrSheet = { name: string; studentNo: string; answers: number[][] };

/** Taranan optik formları puanlayıp katılım olarak kaydeder; oluşan katılım kimliklerini döndürür. */
export async function saveOmrSheets(ownerId: string, testId: string, sheets: OmrSheet[]) {
  const test = await prisma.test.findFirst({ where: { id: testId, ownerId }, select: { id: true } });
  if (!test) throw notFound();
  const questions = await questionsOf(test.id);
  const formQuestions = questions.filter((q) => choiceCountFor(q) > 0);

  const ids: string[] = [];
  for (const s of sheets) {
    const answers: Record<string, SubmittedAnswer> = {};
    formQuestions.forEach((q, i) => {
      const marked = s.answers[i] ?? [];
      answers[q.id] = { optionIds: marked.map((k) => q.options[k]?.id).filter(Boolean) as string[] };
    });
    const { score, maxScore, rows } = gradeAll(questions, answers);
    const a = await prisma.attempt.create({
      data: {
        testId: test.id,
        participantName: s.name.trim() || (s.studentNo ? `Öğrenci ${s.studentNo}` : "Adsız öğrenci"),
        studentNo: s.studentNo,
        source: "OMR",
        finishedAt: new Date(),
        score,
        maxScore,
        answers: { create: rows },
      },
    });
    ids.push(a.id);
  }
  return { ids };
}
