import { requireOwner } from "@/modules/identity/server";
import { normalizePeriod, parentReports } from "@/modules/reporting/server";
import VeliKarne from "@/modules/reporting/ui/veli/VeliKarne";
import { PageHeader } from "@/shared/ui/kurum";
import PrintButton from "@/shared/ui/PrintButton";

export const dynamic = "force-dynamic";

type SP = Promise<{ sinif?: string; ogrenci?: string; bas?: string; bit?: string }>;

/** Bir sınıfın (veya tek öğrencinin) veli karnelerini yazdırma / önizleme. */
export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const { from, to } = normalizePeriod(sp.bas, sp.bit);
  const filter = sp.ogrenci ? { ids: [sp.ogrenci] } : sp.sinif === "_dis" ? { external: true } : { classroomId: sp.sinif ?? "" };
  const reports = await parentReports(ownerId, filter, from, to);
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
