import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { gradeAll, SubmittedAnswer } from "@/modules/online-test";

/** Katılımcının sınavı göndermesi. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const test = await prisma.test.findUnique({
    where: { shareCode: code },
    include: { questions: { include: { options: true } } },
  });
  if (!test || !test.isPublished) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Ad soyad gerekli." }, { status: 400 });
  const answers: Record<string, SubmittedAnswer> = body.answers ?? {};
  const { score, maxScore, rows } = gradeAll(test.questions, answers);
  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();

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
  return NextResponse.json({ id: attempt.id });
}
