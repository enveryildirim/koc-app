import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOwnedTest, getUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

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

async function guard(ctx: Ctx) {
  const user = await getUser();
  if (!user) return null;
  const { id } = await ctx.params;
  return getOwnedTest(id, user.id);
}

export async function PUT(req: Request, ctx: Ctx) {
  const test = await guard(ctx);
  if (!test) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  const body = await req.json();
  const questions: QuestionIn[] = body.questions ?? [];

  await prisma.$transaction(async (tx) => {
    await tx.test.update({
      where: { id: test.id },
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

    // Var olan soru/şıkları güncelle; böylece eski katılımların cevapları bozulmaz.
    const existing = await tx.question.findMany({ where: { testId: test.id }, select: { id: true } });
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
        : await tx.question.create({ data: { ...data, testId: test.id } });

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
    where: { testId: test.id },
    orderBy: { order: "asc" },
    select: { id: true, options: { orderBy: { order: "asc" }, select: { id: true } } },
  });
  return NextResponse.json({ questions: saved });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const test = await guard(ctx);
  if (!test) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  await prisma.test.delete({ where: { id: test.id } });
  return NextResponse.json({ ok: true });
}
