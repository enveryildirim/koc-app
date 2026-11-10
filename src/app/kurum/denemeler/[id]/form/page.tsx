import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { findExam } from "@/modules/exams/server";
import { examFormSpec } from "@/modules/exams";
import { classroomsOf, listStudents } from "@/modules/enrollment/server";
import FormSvg from "@/shared/omr/FormSvg";
import { qrMatrix } from "@/shared/omr/qr";
import PrintButton from "@/shared/ui/PrintButton";
import FormStudentNo from "@/modules/exams/ui/FormStudentNo";

export const dynamic = "force-dynamic";

type SP = Promise<{ kisisel?: string; sinif?: string }>;

/**
 * Optik form basımı. Genel form: tek sayfa, fotokopiyle çoğaltılır.
 * Kişisel form (?kisisel=1&sinif=): sınıfın her öğrencisi için ad, numara, QR ve kimlik şeridi basılı bir sayfa.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const exam = await findExam(ownerId, id);
  if (!exam) notFound();
  const spec = examFormSpec(exam.name, exam.type, exam.secs, exam.letters, { studentNumber: exam.omrStudentNo });
  const page = { width: "210mm", height: "297mm" };

  if (!sp.kisisel) {
    return (
      <div>
        <div className="no-print mb-4 flex flex-wrap items-center gap-3">
          <PrintButton />
          <FormStudentNo examId={id} on={exam.omrStudentNo !== false} compact />
          <span className="text-sm text-lead">A4, kenar boşluğu “yok” ve ölçek %100 olarak yazdırın. Gerekli sayıda fotokopi çekebilirsiniz.</span>
        </div>
        <div className="print-page mx-auto bg-white shadow-lg print:shadow-none" style={page}>
          <FormSvg info={spec} style={{ ...page, display: "block" }} />
        </div>
      </div>
    );
  }

  const classes = await classroomsOf(ownerId);
  const cls = classes.find((c) => c.id === sp.sinif) ?? classes[0];
  const students = cls ? await listStudents(ownerId, { classroomId: cls.id, external: false }, "number") : [];
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost"}`;

  return (
    <div>
      <div className="no-print mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/kurum/denemeler/${id}?tab=optik`} className="text-sm text-lead hover:text-graphite">Deneme</Link>
          <span className="text-sm font-semibold">Kişisel formlar</span>
          {classes.map((c) => (
            <Link
              key={c.id}
              href={`/kurum/denemeler/${id}/form?kisisel=1&sinif=${c.id}`}
              className={c.id === cls?.id ? "btn-primary px-3 py-1.5 text-xs" : "btn-secondary px-3 py-1.5 text-xs"}
            >
              {c.name}
            </Link>
          ))}
          <PrintButton label={`${students.length} formu yazdır`} />
        </div>
        <p className="max-w-[80ch] text-sm text-lead">
          Her öğrenciye adı ve numarası basılı bir form çıkar; numara kodlanmaz, okuyucu alt kenardaki kimlik şeridinden okur. Formlar kişiye özeldir, fotokopiyle
          çoğaltmayın. A4, kenar boşluğu “yok”, ölçek %100 yazdırın. QR kod okutulduğunda öğrencinin kurum sayfası açılır.
        </p>
      </div>
      {students.length === 0 ? (
        <p className="text-sm text-lead">Bu sınıfta öğrenci yok.</p>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {students.map((st) => {
            const info = {
              ...spec,
              personal: {
                studentNo: st.studentNo,
                name: `${st.firstName} ${st.lastName}`,
                className: cls!.name,
                qr: qrMatrix(`${origin}/kurum/ogrenciler/${st.id}`),
              },
            };
            return (
              <div key={st.id} className="print-page mx-auto break-after-page bg-white shadow-lg print:shadow-none" style={page}>
                <FormSvg info={info} style={{ ...page, display: "block" }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
