import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { listTests } from "@/modules/online-test/server";
import NewTestButton from "@/modules/online-test/ui/NewTestButton";

export const dynamic = "force-dynamic";

export default async function Panel() {
  const tests = await listTests(await requireOwner());
  const totalAttempts = tests.reduce((s, t) => s + t.attemptCount, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sınavlarım</h1>
          <p className="text-sm text-lead">
            {tests.length} sınav · {totalAttempts} katılım
          </p>
        </div>
        <NewTestButton />
      </div>

      {tests.length === 0 ? (
        <div className="card mt-8 p-12 text-center text-lead">Henüz sınavınız yok. İlk sınavınızı oluşturun!</div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {tests.map((t) => {
            const avg = t.avgPercent;
            return (
              <div key={t.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/sinav/${t.id}/duzenle`} className="text-lg font-semibold hover:text-brand-600">
                    {t.title}
                  </Link>
                  <span className={`badge ${t.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-mist text-lead"}`}>
                    {t.isPublished ? "Yayında" : "Taslak"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-lead">{t.description || "Açıklama yok"}</p>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Soru" value={t.questionCount} />
                  <Stat label="Katılım" value={t.attemptCount} />
                  <Stat label="Ortalama" value={avg === null ? "–" : `%${avg}`} />
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/sinav/${t.id}/duzenle`} className="btn-secondary">Düzenle</Link>
                  <Link href={`/sinav/${t.id}/sonuclar`} className="btn-secondary">Sonuçlar</Link>
                  <Link href={`/sinav/${t.id}/optik`} className="btn-secondary">Optik form</Link>
                  <span className="ml-auto self-center font-mono text-xs text-lead/70">Kod: {t.shareCode}</span>
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
    <div className="rounded-lg bg-paper py-2">
      <dd className="text-lg font-bold">{value}</dd>
      <dt className="text-xs text-lead">{label}</dt>
    </div>
  );
}
