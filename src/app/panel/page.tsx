import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { listTests } from "@/modules/online-test/server";
import NewTestButton from "@/modules/online-test/ui/NewTestButton";
import { Empty, PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

export default async function Panel() {
  const tests = await listTests(await requireOwner());
  const totalAttempts = tests.reduce((s, t) => s + t.attemptCount, 0);

  return (
    <div>
      <PageHeader title="Online testler" sub={`${tests.length} sınav · ${totalAttempts} katılım. Bağlantıyla paylaşılan, otomatik puanlanan testler.`} actions={<NewTestButton />} />

      {tests.length === 0 ? (
        <Empty>Henüz online test yok. “Yeni sınav” ile ilkini oluşturun.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {tests.map((t) => {
            const avg = t.avgPercent;
            return (
              <div key={t.id} className="card flex flex-col px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/sinav/${t.id}/duzenle`} className="font-semibold hover:text-ink">
                    {t.title}
                  </Link>
                  <span className={`badge ${t.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-mist text-lead"}`}>
                    {t.isPublished ? "Yayında" : "Taslak"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-lead">{t.description || "Açıklama yok"}</p>
                <dl className="mt-2 flex flex-wrap gap-x-4 text-[13px] text-lead">
                  <Stat label="soru" value={t.questionCount} />
                  <Stat label="katılım" value={t.attemptCount} />
                  <Stat label="ortalama" value={avg === null ? "–" : `%${avg}`} />
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
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

/** Tek satırlık özet: "20 soru · 17 katılım · %64 ortalama". */
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1">
      <dd className="num font-semibold text-graphite">{value}</dd>
      <dt>{label}</dt>
    </div>
  );
}
