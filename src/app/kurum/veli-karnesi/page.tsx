import { classroomsOf } from "@/modules/enrollment/server";
import { institutionName, requireOwner } from "@/modules/identity/server";
import { normalizePeriod, parentShares } from "@/modules/reporting/server";
import { Empty, PageHeader } from "@/shared/ui/kurum";
import VeliPanel from "@/modules/reporting/ui/veli/VeliPanel";

export const dynamic = "force-dynamic";

type SP = Promise<{ sinif?: string; bas?: string; bit?: string }>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const classes = await classroomsOf(ownerId);
  const institution = await institutionName(ownerId);
  const sinif = sp.sinif ?? classes[0]?.id ?? "";
  const { from, to } = normalizePeriod(sp.bas, sp.bit);

  const students = await parentShares(ownerId, sinif === "_dis" ? { external: true } : { classroomId: sinif });

  return (
    <>
      <PageHeader
        title="Veli Karnesi"
        sub="Seçilen dönemin deneme, ödev ve devam özetini velilere giriş gerektirmeyen bir bağlantıyla gönderin."
      />
      {classes.length === 0 ? (
        <Empty>Önce sınıf ve öğrenci ekleyin.</Empty>
      ) : (
        <VeliPanel
          institution={institution}
          classes={[...classes.map((c) => ({ id: c.id, name: c.name })), { id: "_dis", name: "Kurum dışı" }]}
          sinif={sinif}
          from={from}
          to={to}
          students={students}
        />
      )}
    </>
  );
}
