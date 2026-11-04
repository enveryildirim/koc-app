import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { listExams } from "@/modules/exams/server";
import { EXAM_TYPES, fmtDate, fmtNet, totalQuestions } from "@/modules/exams";
import { Empty, PageHeader, th, td } from "@/shared/ui/kurum";
import NewExam from "@/modules/exams/ui/NewExam";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ownerId = await requireOwner();
  const exams = await listExams(ownerId);
  return (
    <>
      <PageHeader
        title="Denemeler ve optik okuma"
        sub="Deneme sınavı oluşturun, cevap anahtarını girin, optik formları tarayın veya optik okuyucu dosyasını yükleyin."
        actions={<Link href="/kurum/denemeler/birlesik" className="btn-secondary">Birleştirilmiş raporlar</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {exams.length === 0 ? (
          <Empty>Henüz deneme yok.</Empty>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper">
                <tr>
                  <th className={th}>Sınav</th>
                  <th className={th}>Tür</th>
                  <th className={th}>Tarih</th>
                  <th className={`${th} text-right`}>Katılım</th>
                  <th className={`${th} text-right`}>Ort. net</th>
                  <th className={th}>Anahtar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/70">
                {exams.map((e) => {
                  const secs = e.secs;
                  const total = totalQuestions(secs);
                  const keyed = secs.every((s) => s.keyA.length === s.count);
                  return (
                    <tr key={e.id} className="hover:bg-paper">
                      <td className={td}>
                        <Link href={`/kurum/denemeler/${e.id}`} className="font-medium hover:text-brand-600">{e.name}</Link>
                      </td>
                      <td className={td}>
                        <span className="badge badge-plain bg-mist text-graphite">{EXAM_TYPES[e.type]?.label ?? e.type}</span>
                        <span className="ml-1 text-xs text-lead/70">{total} soru</span>
                      </td>
                      <td className={`${td} text-lead`}>{fmtDate(e.date)}</td>
                      <td className={`${td} text-right`}>{e.resultCount}</td>
                      <td className={`${td} text-right font-semibold tabular-nums`}>{e.avgNet === null ? "—" : fmtNet(e.avgNet)}</td>
                      <td className={td}>
                        {keyed ? <span className="badge bg-emerald-50 text-emerald-700">Hazır</span> : <span className="badge bg-amber-50 text-amber-700">Eksik</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <NewExam />
      </div>
    </>
  );
}
