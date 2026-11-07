import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { listExams } from "@/modules/exams/server";
import { EXAM_TYPES, fmtDate, fmtNet, totalQuestions } from "@/modules/exams";
import { Empty, PageHeader, th, td } from "@/shared/ui/kurum";
import NewExam from "@/modules/exams/ui/NewExam";
import { listCourses } from "@/modules/schedule/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ownerId = await requireOwner();
  const [exams, courses] = await Promise.all([listExams(ownerId), listCourses(ownerId)]);
  const courseLabel = new Map(courses.map((c) => [c.id, `${c.classroomName} · ${c.name}`]));
  return (
    <>
      <PageHeader
        title="Denemeler ve optik okuma"
        sub="Deneme sınavı oluşturun, cevap anahtarını girin, optik formları tarayın veya optik okuyucu dosyasını yükleyin."
        actions={
          <>
            <Link href="/kurum/denemeler/birlesik" className="btn-secondary">Birleştirilmiş raporlar</Link>
            <Link href="/kurum/denemeler/havuzdan" className="btn-primary">Havuzdan deneme oluştur</Link>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        {exams.length === 0 ? (
          <Empty>Henüz deneme yok.</Empty>
        ) : (
          <>
          {/* Telefonda kart: sınav adı ve ortalama net önde; tür, tarih, katılım ve anahtar durumu altında. */}
          <ul className="card divide-y divide-rule/70 sm:hidden">
            {exams.map((e) => {
              const keyed = e.secs.every((s) => s.keyA.length === s.count);
              return (
                <li key={e.id}>
                  <Link href={`/kurum/denemeler/${e.id}`} className="block px-3.5 py-2.5 active:bg-paper">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{e.name}</span>
                      <span className="num shrink-0 font-semibold">{e.avgNet === null ? "—" : fmtNet(e.avgNet)}<span className="ml-1 text-xs font-normal text-lead">net</span></span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-lead">
                      <span className="badge badge-plain bg-mist text-graphite">{EXAM_TYPES[e.type]?.label ?? e.type}</span>
                      <span>{fmtDate(e.date)}</span>
                      <span>{e.resultCount} katılım</span>
                      {keyed ? <span className="badge bg-emerald-50 text-emerald-700">Anahtar hazır</span> : <span className="badge bg-amber-50 text-amber-700">Anahtar eksik</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="card hidden overflow-x-auto sm:block">
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
                        {e.courseId && courseLabel.get(e.courseId) && <span className="block text-[12.5px] text-lead">{courseLabel.get(e.courseId)}</span>}
                      </td>
                      <td className={td}>
                        {e.purpose === "WORKSHEET" ? (
                          <span className="badge badge-plain bg-sky-50 text-sky-800">Çalışma kağıdı</span>
                        ) : (
                          <span className="badge badge-plain bg-mist text-graphite">{EXAM_TYPES[e.type]?.label ?? e.type}</span>
                        )}
                        <span className="ml-1 text-xs text-lead/70">{total} soru</span>
                      </td>
                      <td className={`${td} text-lead`}>{fmtDate(e.date)}</td>
                      <td className={`${td} text-right`}>{e.resultCount}</td>
                      <td className={`${td} text-right font-semibold tabular-nums`}>{e.avgNet === null ? "—" : fmtNet(e.avgNet)}</td>
                      <td className={td}>
                        {e.purpose === "WORKSHEET" ? <span className="text-[12.5px] text-lead">puanlanmaz</span> : keyed ? <span className="badge bg-emerald-50 text-emerald-700">Hazır</span> : <span className="badge bg-amber-50 text-amber-700">Eksik</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
        <NewExam
          courses={courses.filter((c) => c.kind !== "STUDY").map((c) => ({ id: c.id, label: `${c.classroomName} · ${c.name}` }))}
          formats={exams.filter((e) => e.readerFormat).map((e) => ({ id: e.id, name: e.name }))}
        />
      </div>
    </>
  );
}
