import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { examReport } from "@/modules/exams/server";
import Karne from "@/modules/exams/ui/Karne";
import { PageHeader } from "@/shared/ui/kurum";
import PrintButton from "@/shared/ui/PrintButton";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string; resultId: string }> }) {
  const ownerId = await requireOwner();
  const { id, resultId } = await params;
  const report = await examReport(ownerId, id);
  if (!report) notFound();
  const row = report.rows.find((r) => r.id === resultId);
  if (!row) notFound();
  return (
    <>
      <PageHeader
        title="Öğrenci karnesi"
        back={{ href: `/kurum/denemeler/${id}`, label: report.exam.name }}
        actions={<PrintButton label="Karneyi yazdır" />}
      />
      <Karne report={report} row={row} />
    </>
  );
}
