import { notFound } from "next/navigation";
import { prisma } from "@/shared/db";
import TakeTest, { PublicTest } from "@/modules/online-test/ui/TakeTest";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const t = await prisma.test.findUnique({
    where: { shareCode: code.toUpperCase() },
    include: { questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } } },
  });
  if (!t || !t.isPublished) notFound();

  let questions = t.questions;
  if (t.shuffleQuestions) questions = [...questions].sort(() => Math.random() - 0.5);

  // Doğru cevaplar istemciye gönderilmez.
  const test: PublicTest = {
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
  return <TakeTest test={test} />;
}
