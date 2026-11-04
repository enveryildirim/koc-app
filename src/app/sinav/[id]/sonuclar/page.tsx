import { prisma } from "@/shared/db";
import { pct } from "@/modules/online-test";
import AttemptsTable from "@/modules/online-test/ui/AttemptsTable";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const test = await prisma.test.findUniqueOrThrow({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" }, include: { answers: { select: { isCorrect: true, optionIds: true, text: true } } } },
      attempts: { orderBy: { finishedAt: "desc" } },
    },
  });
  const attempts = test.attempts;
  const percents = attempts.map((a) => pct(a.score, a.maxScore));
  const avg = percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0;
  const passed = percents.filter((p) => p >= test.passPercent).length;

  const buckets = Array.from({ length: 10 }, (_, i) => ({
    label: i === 9 ? "90–100" : `${i * 10}–${i * 10 + 9}`,
    n: percents.filter((p) => Math.min(9, Math.floor(p / 10)) === i).length,
  }));
  const maxBucket = Math.max(1, ...buckets.map((b) => b.n));

  const qStats = test.questions.map((q, i) => {
    const total = attempts.length;
    const correct = q.answers.filter((a) => a.isCorrect).length;
    const blank = total - q.answers.filter((a) => JSON.parse(a.optionIds).length > 0 || a.text.trim()).length;
    return { i, text: q.text, correct, wrong: total - correct - blank, blank, rate: total ? Math.round((correct / total) * 100) : 0 };
  });

  if (attempts.length === 0) {
    return (
      <div className="card mt-6 p-12 text-center text-slate-500">
        Henüz katılım yok. Sınav bağlantısını paylaşın veya <b>Optik Form</b> sekmesinden form tarayın.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Kpi label="Katılım" value={attempts.length} />
        <Kpi label="Ortalama" value={`%${avg}`} />
        <Kpi label="En yüksek" value={`%${Math.max(...percents)}`} />
        <Kpi label="En düşük" value={`%${Math.min(...percents)}`} />
        <Kpi label="Geçen" value={`${passed} (%${Math.round((passed / attempts.length) * 100)})`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Puan dağılımı (%)</h2>
          <div className="mt-4 flex h-44 items-end gap-2">
            {buckets.map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-slate-500">{b.n || ""}</span>
                <div className="w-full rounded-t bg-brand-500" style={{ height: `${(b.n / maxBucket) * 130}px` }} />
                <span className="text-[10px] text-slate-500">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Soru bazlı başarı</h2>
          <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-2">
            {qStats.map((s) => (
              <div key={s.i} className="flex items-center gap-3 text-sm" title={s.text}>
                <span className="w-8 shrink-0 font-semibold text-slate-500">S{s.i + 1}</span>
                <div className="flex h-4 flex-1 overflow-hidden rounded bg-slate-100">
                  <div className="bg-emerald-500" style={{ width: `${(s.correct / attempts.length) * 100}%` }} />
                  <div className="bg-red-400" style={{ width: `${(s.wrong / attempts.length) * 100}%` }} />
                </div>
                <span className={`w-12 text-right font-semibold ${s.rate < 40 ? "text-red-600" : "text-slate-700"}`}>%{s.rate}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-500" />Doğru</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-red-400" />Yanlış</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-slate-200" />Boş</span>
          </div>
        </div>
      </div>

      <AttemptsTable
        testTitle={test.title}
        passPercent={test.passPercent}
        rows={attempts.map((a) => ({
          id: a.id,
          name: a.participantName,
          studentNo: a.studentNo,
          source: a.source,
          score: a.score,
          maxScore: a.maxScore,
          finishedAt: a.finishedAt?.toISOString() ?? null,
          durationMin: a.finishedAt ? Math.round((a.finishedAt.getTime() - a.startedAt.getTime()) / 60000) : null,
        }))}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
