import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { findExam } from "@/modules/exams/server";
import { examFormSpec } from "@/modules/exams";
import FormSvg from "@/shared/omr/FormSvg";
import PrintButton from "@/shared/ui/PrintButton";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const exam = await findExam(ownerId, id);
  if (!exam) notFound();
  const spec = examFormSpec(exam.name, exam.type, exam.secs, exam.bookletB);
  return (
    <div>
      <div className="no-print mb-4 flex items-center gap-3">
        <PrintButton />
        <span className="text-sm text-slate-500">A4, kenar boşluğu “yok” ve ölçek %100 olarak yazdırın. Gerekli sayıda fotokopi çekebilirsiniz.</span>
      </div>
      <div className="print-page mx-auto bg-white shadow-lg print:shadow-none" style={{ width: "210mm", height: "297mm" }}>
        <FormSvg info={spec} style={{ width: "210mm", height: "297mm", display: "block" }} />
      </div>
    </div>
  );
}
