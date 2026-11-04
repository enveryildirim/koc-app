import { prisma } from "@/shared/db";
import { choiceCountFor, MAX_QUESTIONS } from "@/shared/omr/layout";

/** Bir sınavın optik form bilgileri: formdaki sorular ve cevap anahtarı. */
export async function loadOmrData(testId: string) {
  const test = await prisma.test.findUniqueOrThrow({
    where: { id: testId },
    include: { questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } } },
  });
  const eligible = test.questions.filter((q) => choiceCountFor(q) > 0);
  const onForm = eligible.slice(0, MAX_QUESTIONS);
  return {
    test,
    info: { title: test.title, brand: "SınavKur", questions: onForm.map((q) => ({ choiceCount: choiceCountFor(q) })) },
    key: onForm.map((q) => ({
      points: q.points,
      correct: q.options.slice(0, choiceCountFor(q)).flatMap((o, k) => (o.isCorrect ? [k] : [])),
      number: test.questions.indexOf(q) + 1,
    })),
    skipped: test.questions.length - onForm.length,
  };
}
