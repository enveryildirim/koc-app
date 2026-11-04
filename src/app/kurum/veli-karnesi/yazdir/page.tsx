import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/kurum";
import { buildParentReport, normalizePeriod } from "@/lib/parentReport";
import VeliKarne from "@/components/kurum/veli/VeliKarne";
import { PageHeader } from "@/components/kurum/ui";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

type SP = Promise<{ sinif?: string; ogrenci?: string; bas?: string; bit?: string }>;

/** Bir sınıfın (veya tek öğrencinin) veli karnelerini yazdırma / önizleme. */
export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const { from, to } = normalizePeriod(sp.bas, sp.bit);
  const students = await prisma.student.findMany({
    where: {
      ownerId,
      ...(sp.ogrenci ? { id: sp.ogrenci } : sp.sinif === "_dis" ? { external: true } : { classroomId: sp.sinif ?? "" }),
    },
    orderBy: { studentNo: "asc" },
    select: { id: true },
  });
  const reports = await Promise.all(students.map((s) => buildParentReport(s.id, from, to)));
  const back = sp.ogrenci ? `/kurum/ogrenciler/${sp.ogrenci}` : `/kurum/veli-karnesi?sinif=${sp.sinif ?? ""}&bas=${from}&bit=${to}`;
  return (
    <>
      <PageHeader
        title={sp.ogrenci ? "Veli karnesi önizleme" : `Veli karneleri · ${reports.length} öğrenci`}
        sub="Yazdırırken her karne ayrı sayfaya basılır."
        back={{ href: back, label: "Geri" }}
        actions={<PrintButton label="🖨️ Yazdır" />}
      />
      <div className="space-y-6 print:space-y-0">
        {reports.map((r) => (
          <div key={r.student.id} className="break-after-page">
            <VeliKarne r={r} />
          </div>
        ))}
      </div>
    </>
  );
}
