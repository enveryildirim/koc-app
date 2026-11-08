import { notFound } from "next/navigation";
import { requireOwner } from "@/modules/identity/server";
import { schoolYearLabel } from "@/modules/planning";
import { findPlan, planEditorData } from "@/modules/planning/server";
import PlanActions from "@/modules/planning/ui/PlanActions";
import PlanEditor from "@/modules/planning/ui/PlanEditor";
import { planTemplatesByClass } from "@/modules/curriculum/server";
import { planTopicTracking } from "@/modules/reporting/server";
import TopicTracking from "@/modules/reporting/ui/TopicTracking";
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
          templatesByClass={await planTemplatesByClass(ownerId, data.classrooms)}
          holidays={data.holidays}
          initial={{ classroomId: plan.classroomId, subject: plan.subject, startDate: plan.startDate, source: plan.source, parallel: plan.parallel }}
        />
      </div>
    );
  }

  const t = (await planTopicTracking(ownerId, plan.id, today))!;
  const p = t.progress;
  const others = (await planEditorData(ownerId, plan.year)).classrooms.filter((c) => c.id !== plan.classroomId);
  const total = t.rows.length;
  return (
    <div>
      <PageHeader
        back={back}
        title={title}
        sub={`${schoolYearLabel(plan.year)} · konu takibi${plan.parallel ? " · üniteler paralel" : ""}`}
        actions={<PlanActions planId={plan.id} classrooms={others} />}
      />
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label="İşlenen" value={`${p.done}/${p.total}`} hint={`%${p.rate} · bugüne kadar ${p.due} konu planlıydı`} />
        <Kpi label="Geciken konu" value={p.late} hint={p.late ? "planlanan haftası geçti, işlenmedi" : "gecikme yok"} />
        <Kpi label="Durum" value={p.behindWeeks > 0 ? `${p.behindWeeks} hafta geride` : "Plana uygun"} />
        <Kpi
          label="Müfredata bağlı"
          value={`${t.linked}/${total}`}
          hint={t.linked === total ? "hepsi müfredat takibinde" : `${total - t.linked} konu müfredatta yok`}
        />
      </div>
      <p className="mb-3 text-[13px] text-lead">
        Konular yoklama alınırken işaretlenir; buradan da işaretleyebilirsiniz. Sözlü / yazılı değerlendirme bir konuya bağlanınca
        &quot;Değerlendirme&quot; sütununda, konusu girilmiş denemeler &quot;Deneme&quot; sütununda görünür.
      </p>
      <TopicTracking rows={t.rows} holidays={t.holidays} today={today} startDate={plan.startDate} />
    </div>
  );
}
