import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { testWithQuestions } from "@/modules/online-test/server";
import TestEditor, { EditorTest } from "@/modules/online-test/ui/TestEditor";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await testWithQuestions(await requireOwner(), id);
  if (!t) notFound();
  const initial: EditorTest = {
    id: t.id,
    title: t.title,
    description: t.description,
    shareCode: t.shareCode,
    timeLimitMin: t.timeLimitMin ?? "",
    passPercent: t.passPercent,
    shuffleQuestions: t.shuffleQuestions,
    showAnswers: t.showAnswers,
    isPublished: t.isPublished,
    questions: t.questions.map((q) => ({
      id: q.id,
      key: q.id,
      type: q.type,
      text: q.text,
      points: q.points,
      correctText: q.correctText,
      explanation: q.explanation,
      options: q.options.map((o) => ({ id: o.id, key: o.id, text: o.text, isCorrect: o.isCorrect })),
    })),
  };
  return <TestEditor initial={initial} />;
}
