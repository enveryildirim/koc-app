import { notFound } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/modules/identity/server";
import { publicAttemptResult } from "@/modules/online-test/server";
import AttemptDetail, { ScoreSummary } from "@/modules/online-test/ui/AttemptDetail";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  // Cevap anahtarı yalnızca "cevapları göster" açıksa veya bakan sınavın sahibiyse gelir.
  const attempt = await publicAttemptResult(id, user?.id ?? null);
  if (!attempt) notFound();
  const { test, isOwner, answerKey } = attempt;
  const { correct, wrong, blank } = attempt.counts;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {isOwner && (
        <Link href={`/sinav/${test.id}/sonuclar`} className="text-sm text-lead hover:text-graphite">← Sonuçlara dön</Link>
      )}
      <h1 className="mt-2 text-2xl font-bold">{test.title}</h1>
      <p className="text-sm text-lead">
        {attempt.participantName}
        {attempt.studentNo && ` · No: ${attempt.studentNo}`}
        {attempt.source === "OMR" && " · Optik form"}
        {" · "}
        {attempt.finishedAt?.toLocaleString("tr-TR")}
      </p>
      <div className="mt-6">
        <ScoreSummary score={attempt.score} maxScore={attempt.maxScore} passPercent={test.passPercent} correct={correct} wrong={wrong} blank={blank} />
      </div>
      {answerKey && (
        <div className="mt-6">
          <h2 className="mb-3 font-semibold">Cevap anahtarı</h2>
          <AttemptDetail questions={answerKey.questions} answers={answerKey.answers} showAnswers />
        </div>
      )}
    </div>
  );
}
