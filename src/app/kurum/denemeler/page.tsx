import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/kurum";
import { EXAM_TYPES, fmtDate, fmtNet, parseSections, totalQuestions } from "@/lib/exam";
import { Empty, PageHeader, th, td } from "@/components/kurum/ui";
import NewExam from "@/components/kurum/sinav/NewExam";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ownerId = await requireOwner();
  const exams = await prisma.exam.findMany({
    where: { ownerId },
    orderBy: { date: "desc" },
    include: { results: { select: { totalNet: true } } },
  });
  return (
    <>
      <PageHeader
        title="Denemeler & Optik Okuma"
        sub="Deneme sınavı oluşturun, cevap anahtarını girin, optik formları tarayın veya optik okuyucu dosyasını yükleyin."
        actions={<Link href="/kurum/denemeler/birlesik" className="btn-secondary">📊 Birleştirilmiş raporlar</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {exams.length === 0 ? (
          <Empty>Henüz deneme yok.</Empty>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={th}>Sınav</th>
                  <th className={th}>Tür</th>
                  <th className={th}>Tarih</th>
                  <th className={`${th} text-right`}>Katılım</th>
                  <th className={`${th} text-right`}>Ort. net</th>
                  <th className={th}>Anahtar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map((e) => {
                  const secs = parseSections(e.sections);
                  const total = totalQuestions(secs);
                  const keyed = secs.every((s) => s.keyA.length === s.count);
                  const avg = e.results.length ? e.results.reduce((s, r) => s + r.totalNet, 0) / e.results.length : null;
                  return (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className={td}>
                        <Link href={`/kurum/denemeler/${e.id}`} className="font-medium hover:text-brand-600">{e.name}</Link>
                      </td>
                      <td className={td}>
                        <span className="badge bg-brand-50 text-brand-700">{EXAM_TYPES[e.type]?.label ?? e.type}</span>
                        <span className="ml-1 text-xs text-slate-400">{total} soru</span>
                      </td>
                      <td className={`${td} text-slate-500`}>{fmtDate(e.date)}</td>
                      <td className={`${td} text-right`}>{e.results.length}</td>
                      <td className={`${td} text-right font-semibold tabular-nums`}>{avg === null ? "—" : fmtNet(avg)}</td>
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
