import { prisma } from "@/shared/db";
import { classroomsOf } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { normalizePeriod } from "@/modules/reporting/server";
import { Empty, PageHeader } from "@/shared/ui/kurum";
import VeliPanel from "@/modules/reporting/ui/veli/VeliPanel";

export const dynamic = "force-dynamic";

type SP = Promise<{ sinif?: string; bas?: string; bit?: string }>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const classes = await classroomsOf(ownerId);
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { name: true } });
  const sinif = sp.sinif ?? classes[0]?.id ?? "";
  const { from, to } = normalizePeriod(sp.bas, sp.bit);

  const students = await prisma.student.findMany({
    where: { ownerId, ...(sinif === "_dis" ? { external: true } : { classroomId: sinif }) },
    include: { classroom: true },
    orderBy: { studentNo: "asc" },
  });

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
          institution={owner.name}
          classes={[...classes.map((c) => ({ id: c.id, name: c.name })), { id: "_dis", name: "Kurum dışı" }]}
          sinif={sinif}
          from={from}
          to={to}
          students={students.map((s) => ({
            id: s.id,
            name: `${s.firstName} ${s.lastName}`,
            studentNo: s.studentNo,
            className: s.classroom?.name ?? "Kurum dışı",
            parentName: s.parentName,
            parentPhone: s.parentPhone,
            token: s.parentToken,
            sharedAt: s.parentSharedAt?.toISOString() ?? null,
            viewedAt: s.parentViewedAt?.toISOString() ?? null,
            note: s.parentNote,
          }))}
        />
      )}
    </>
  );
}
