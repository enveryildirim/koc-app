import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import NewTestButton from "@/components/NewTestButton";
import { pct } from "@/lib/grading";

export const dynamic = "force-dynamic";

export default async function Panel() {
  const user = await requireUser();
  const tests = await prisma.test.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: true } },
      attempts: { select: { score: true, maxScore: true } },
    },
  });
  const totalAttempts = tests.reduce((s, t) => s + t.attempts.length, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sınavlarım</h1>
          <p className="text-sm text-slate-500">
            {tests.length} sınav · {totalAttempts} katılım
          </p>
        </div>
        <NewTestButton />
      </div>

      {tests.length === 0 ? (
        <div className="card mt-8 p-12 text-center text-slate-500">Henüz sınavınız yok. İlk sınavınızı oluşturun!</div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {tests.map((t) => {
            const avg = t.attempts.length
              ? Math.round(t.attempts.reduce((s, a) => s + pct(a.score, a.maxScore), 0) / t.attempts.length)
              : null;
            return (
              <div key={t.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/sinav/${t.id}/duzenle`} className="text-lg font-semibold hover:text-brand-600">
                    {t.title}
                  </Link>
                  <span className={`badge ${t.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {t.isPublished ? "Yayında" : "Taslak"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{t.description || "Açıklama yok"}</p>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Soru" value={t._count.questions} />
                  <Stat label="Katılım" value={t.attempts.length} />
                  <Stat label="Ortalama" value={avg === null ? "–" : `%${avg}`} />
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/sinav/${t.id}/duzenle`} className="btn-secondary">Düzenle</Link>
                  <Link href={`/sinav/${t.id}/sonuclar`} className="btn-secondary">Sonuçlar</Link>
                  <Link href={`/sinav/${t.id}/optik`} className="btn-secondary">Optik form</Link>
                  <span className="ml-auto self-center font-mono text-xs text-slate-400">Kod: {t.shareCode}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <dd className="text-lg font-bold">{value}</dd>
      <dt className="text-xs text-slate-500">{label}</dt>
    </div>
  );
}
