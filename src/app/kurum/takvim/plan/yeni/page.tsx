import { requireOwner } from "@/modules/identity/server";
import { defaultPlanStart, schoolYearLabel, schoolYearOf } from "@/modules/planning";
import { planEditorData } from "@/modules/planning/server";
import PlanEditor from "@/modules/planning/ui/PlanEditor";
import { ymd } from "@/shared/date";
import { Empty, PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ yil?: string; sinif?: string; ders?: string }> }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const year = Number(sp.yil) >= 2000 && Number(sp.yil) <= 2100 ? Number(sp.yil) : schoolYearOf(ymd());
  const data = await planEditorData(ownerId, year);
  const classroomId = data.classrooms.some((c) => c.id === sp.sinif) ? sp.sinif! : (data.classrooms[0]?.id ?? "");

  return (
    <div>
      <PageHeader back={{ href: `/kurum/takvim/plan?yil=${year}`, label: "Yıllık ders planı" }} title="Yeni yıllık plan" sub={`${schoolYearLabel(year)} eğitim yılı`} />
      {!data.classrooms.length ? (
        <Empty>Önce Öğrenciler sayfasından sınıf ekleyin.</Empty>
      ) : (
        <PlanEditor
          year={year}
          classrooms={data.classrooms}
          subjectsByClass={data.subjectsByClass}
          holidays={data.holidays}
          initial={{ classroomId, subject: sp.ders ?? "", startDate: defaultPlanStart(year), source: "" }}
        />
      )}
    </div>
  );
}
