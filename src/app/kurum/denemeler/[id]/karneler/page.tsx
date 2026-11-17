import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { examReport, resultSolutionTokens } from "@/modules/exams/server";
import { publicOrigin } from "@/shared/origin";
import Karne from "@/modules/exams/ui/Karne";
import { PageHeader } from "@/shared/ui/kurum";
import PrintButton from "@/shared/ui/PrintButton";

export const dynamic = "force-dynamic";

/** Seçili sınıfın (veya tüm kurumun) karneleri; her karne yazdırırken ayrı sayfaya düşer. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sinif?: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const { sinif } = await searchParams;
  const report = await examReport(ownerId, id);
  if (!report) notFound();
  const rows = report.rows
    .filter((r) => !sinif || r.classId === sinif)
    .sort((a, b) => a.className.localeCompare(b.className, "tr") || a.studentNo.localeCompare(b.studentNo));
  // Havuzdan kurulmuş denemede her karneye kişisel çözüm QR'ı
  const tokens = report.secs.some((s) => s.items?.length) ? await resultSolutionTokens(ownerId, id) : null;
  const origin = await publicOrigin();
  return (
    <>
      <PageHeader
        title={`Toplu karne · ${rows.length} öğrenci`}
        sub="Yazdırırken her karne ayrı sayfaya basılır."
        back={{ href: `/kurum/denemeler/${id}${sinif ? `?sinif=${sinif}` : ""}`, label: report.exam.name }}
        actions={<PrintButton label="Tümünü yazdır" />}
      />
      <div className="space-y-6 print:space-y-0">
        {rows.map((r) => (
          <div key={r.id} className="break-after-page">
            <Karne report={report} row={r} solutionUrl={tokens?.get(r.id) ? `${origin}/cozum/${tokens.get(r.id)}` : null} />
          </div>
        ))}
      </div>
    </>
  );
}
