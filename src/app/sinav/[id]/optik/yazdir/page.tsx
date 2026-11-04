import FormSvg from "@/shared/omr/FormSvg";
import PrintButton from "@/shared/ui/PrintButton";
import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { omrForm } from "@/modules/online-test/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await omrForm(await requireOwner(), id);
  if (!form) notFound();
  const { info } = form;
  return (
    <div className="mt-6">
      <div className="no-print mb-4 flex items-center gap-3">
        <PrintButton />
        <span className="text-sm text-lead">A4, kenar boşluğu “yok” ve ölçek %100 olarak yazdırın.</span>
      </div>
      <div className="print-page mx-auto bg-white shadow-lg print:shadow-none" style={{ width: "210mm", height: "297mm" }}>
        <FormSvg info={info} style={{ width: "210mm", height: "297mm", display: "block" }} />
      </div>
    </div>
  );
}
