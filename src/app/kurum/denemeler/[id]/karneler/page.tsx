import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/kurum";
import { examReport, loadExam } from "@/lib/examServer";
import Karne from "@/components/kurum/sinav/Karne";
import { PageHeader } from "@/components/kurum/ui";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

/** Seçili sınıfın (veya tüm kurumun) karneleri; her karne yazdırırken ayrı sayfaya düşer. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sinif?: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const { sinif } = await searchParams;
  if (!(await loadExam(ownerId, id))) notFound();
  const report = await examReport(id);
  const rows = report.rows
    .filter((r) => !sinif || r.classId === sinif)
    .sort((a, b) => a.className.localeCompare(b.className, "tr") || a.studentNo.localeCompare(b.studentNo));
  return (
    <>
      <PageHeader
        title={`Toplu karne · ${rows.length} öğrenci`}
        sub="Yazdırırken her karne ayrı sayfaya basılır."
        back={{ href: `/kurum/denemeler/${id}${sinif ? `?sinif=${sinif}` : ""}`, label: report.exam.name }}
        actions={<PrintButton label="🖨️ Tümünü yazdır" />}
      />
      <div className="space-y-6 print:space-y-0">
        {rows.map((r) => (
          <div key={r.id} className="break-after-page">
            <Karne report={report} row={r} />
          </div>
        ))}
      </div>
    </>
  );
}
