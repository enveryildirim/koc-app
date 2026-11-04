import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { planProgress, schoolYearLabel } from "@/modules/planning";
import { findPlan, planEditorData } from "@/modules/planning/server";
import PlanActions from "@/modules/planning/ui/PlanActions";
import PlanEditor from "@/modules/planning/ui/PlanEditor";
import PlanItems from "@/modules/planning/ui/PlanItems";
import { ymd } from "@/shared/date";
import { Kpi, PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ duzenle?: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const { duzenle } = await searchParams;
  const plan = await findPlan(ownerId, id);
  if (!plan) notFound();
  const today = ymd();
  const title = `${plan.subject} · ${plan.classroom.name}`;
  const back = { href: `/kurum/takvim/plan?yil=${plan.year}`, label: "Yıllık ders planı" };

  if (duzenle) {
    const data = await planEditorData(ownerId, plan.year);
    return (
      <div>
        <PageHeader back={{ href: `/kurum/takvim/plan/${plan.id}`, label: title }} title="Planı düzenle" sub={`${schoolYearLabel(plan.year)} eğitim yılı`} />
        <PlanEditor
          planId={plan.id}
          year={plan.year}
          classrooms={data.classrooms}
          subjectsByClass={data.subjectsByClass}
          holidays={data.holidays}
          initial={{ classroomId: plan.classroomId, subject: plan.subject, startDate: plan.startDate, source: plan.source }}
        />
      </div>
    );
  }

  const p = planProgress(plan.items, today);
  const others = (await planEditorData(ownerId, plan.year)).classrooms.filter((c) => c.id !== plan.classroomId);
  return (
    <div>
      <PageHeader back={back} title={title} sub={`${schoolYearLabel(plan.year)} eğitim yılı yıllık planı`} actions={<PlanActions planId={plan.id} classrooms={others} />} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="İşlenen" value={`${p.done} / ${p.total}`} hint={`%${p.rate}`} />
        <Kpi label="Bugüne kadar planlanan" value={p.due} hint="bitiş haftası geçmiş konular" />
        <Kpi label="Geciken konu" value={p.late} />
        <Kpi label="Durum" value={p.behindWeeks > 0 ? `${p.behindWeeks} hafta geride` : "Plana uygun"} />
      </div>
      <PlanItems items={plan.items} holidays={plan.holidays} today={today} startDate={plan.startDate} />
    </div>
  );
}
