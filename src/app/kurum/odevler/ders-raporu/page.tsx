import Link from "next/link";
import { requireOwner } from "@/modules/identity/server";
import { doneRate } from "@/modules/homework";
import { homeworkByClassSubject } from "@/modules/homework/server";
import { Empty, PageHeader, Tabs, td, th } from "@/shared/ui/kurum";
import ExportButton from "@/shared/ui/ExportButton";
import { ODEV_TABS } from "@/modules/homework/ui/tabs";

export const dynamic = "force-dynamic";

/** Sınıf × ders ödev raporu: son 60 günde teslimi geçmiş ödevler; yapma oranı düşükten yükseğe. */
export default async function Page() {
  const ownerId = await requireOwner();
  const rows = (await homeworkByClassSubject(ownerId)).map((r) => ({ ...r, rate: doneRate(r.counts) }));
  rows.sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));

  return (
    <>
      <PageHeader
        title="Ödev takibi"
        sub="Son 60 günde teslimi geçmiş ödevler, sınıf ve derse göre. Yapma oranı en düşük olan üstte."
        actions={
          <ExportButton
            fileName="odev-sinif-ders"
            sheet="Sınıf ve ders"
            headers={["Sınıf", "Ders", "Ödev", "Yaptı", "Eksik", "Yapmadı", "İşaretlenmedi", "Yapma oranı (%)"]}
            rows={rows.map((r) => [r.classroom, r.subject, r.count, r.counts.DONE, r.counts.PARTIAL, r.counts.NOT_DONE, r.counts.PENDING, r.rate ?? ""])}
          />
        }
      />
      <Tabs tabs={ODEV_TABS} active="ders" />
      {rows.length === 0 ? (
        <Empty>Son 60 günde teslimi geçmiş ödev yok.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr>
                <th className={th}>Sınıf</th>
                <th className={th}>Ders</th>
                <th className={`${th} text-right`}>Ödev</th>
                <th className={`${th} text-right`}>Yaptı</th>
                <th className={`${th} text-right`}>Eksik</th>
                <th className={`${th} text-right`}>Yapmadı</th>
                <th className={`${th} text-right`}>İşaretlenmedi</th>
                <th className={`${th} text-right`}>Yapma oranı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/70">
              {rows.map((r) => (
                <tr key={`${r.classroomId}-${r.subject}`}>
                  <td className={td}><Link href={`/kurum/odevler?sinif=${r.classroomId}`} className="font-medium hover:underline">{r.classroom}</Link></td>
                  <td className={td}>{r.subject}</td>
                  <td className={`${td} num text-right`}>{r.count}</td>
                  <td className={`${td} num text-right text-emerald-700`}>{r.counts.DONE}</td>
                  <td className={`${td} num text-right text-amber-700`}>{r.counts.PARTIAL}</td>
                  <td className={`${td} num text-right text-red-700`}>{r.counts.NOT_DONE}</td>
                  <td className={`${td} num text-right ${r.counts.PENDING ? "font-semibold text-amber-700" : "text-lead"}`}>{r.counts.PENDING}</td>
                  <td className={`${td} num text-right font-semibold ${r.rate !== null && r.rate < 70 ? "text-red-700" : ""}`}>{r.rate === null ? "—" : `%${r.rate}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[13px] text-lead">“İşaretlenmedi”: teslim tarihi geçtiği hâlde öğretmenin durum girmediği öğrenci sayısı. Yapma oranı: tam yapılan ödevler / durumu girilenler (öğrenci bazında raporla aynı).</p>
    </>
  );
}
