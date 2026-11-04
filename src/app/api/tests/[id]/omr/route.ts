import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { getOwnedTest } from "@/modules/online-test/server";
import { getUser } from "@/modules/identity/server";
import { gradeAll, SubmittedAnswer } from "@/modules/online-test";
import { choiceCountFor } from "@/shared/omr/layout";

type Sheet = { name: string; studentNo: string; answers: number[][] };

/** Taranan optik formları katılım olarak kaydeder. answers[i] = i. formdaki sorunun işaretli şık indeksleri. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await ctx.params;
  const test = user && (await getOwnedTest(id, user.id));
  if (!test) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const { sheets } = (await req.json()) as { sheets: Sheet[] };
  const questions = await prisma.question.findMany({
    where: { testId: test.id },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } } },
  });
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
  return NextResponse.json({ ids });
}
