import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import AttemptDetail, { ScoreSummary } from "@/components/AttemptDetail";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attempt = await prisma.attempt.findUnique({
    where: { id },
    include: {
      answers: true,
      test: { include: { questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } } } },
    },
  });
  if (!attempt) notFound();
  const user = await getUser();
  const isOwner = user?.id === attempt.test.ownerId;
  const { test } = attempt;
  const byQ = new Map(attempt.answers.map((a) => [a.questionId, a]));
  let correct = 0, wrong = 0, blank = 0;
  for (const q of test.questions) {
    const a = byQ.get(q.id);
    if (!a || (JSON.parse(a.optionIds).length === 0 && !a.text.trim())) blank++;
    else if (a.isCorrect) correct++;
    else wrong++;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {isOwner && (
        <Link href={`/sinav/${test.id}/sonuclar`} className="text-sm text-slate-500 hover:text-slate-800">← Sonuçlara dön</Link>
      )}
      <h1 className="mt-2 text-2xl font-bold">{test.title}</h1>
      <p className="text-sm text-slate-500">
        {attempt.participantName}
        {attempt.studentNo && ` · No: ${attempt.studentNo}`}
        {attempt.source === "OMR" && " · Optik form"}
        {" · "}
        {attempt.finishedAt?.toLocaleString("tr-TR")}
      </p>
      <div className="mt-6">
        <ScoreSummary score={attempt.score} maxScore={attempt.maxScore} passPercent={test.passPercent} correct={correct} wrong={wrong} blank={blank} />
      </div>
      {(test.showAnswers || isOwner) && (
        <div className="mt-6">
          <h2 className="mb-3 font-semibold">Cevap anahtarı</h2>
          <AttemptDetail questions={test.questions} answers={attempt.answers} showAnswers />
        </div>
      )}
    </div>
  );
}
