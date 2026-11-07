import { ymd } from "@/shared/date";
import { classroomsOf } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { listAssessments, listRubrics } from "@/modules/assessment/server";
import { listCourses } from "@/modules/schedule/server";
import { PageHeader, Tabs } from "@/shared/ui/kurum";
import AssessmentList from "@/modules/assessment/ui/AssessmentList";
import RubricManager from "@/modules/assessment/ui/RubricManager";
import NewAssessmentForm from "@/modules/assessment/ui/NewAssessmentForm";

export const dynamic = "force-dynamic";

type SP = Promise<{ tab?: string; sinif?: string }>;

/** Sözlü, yazılı ve uygulama değerlendirmeleri; puan cetvelleri (yönetici). */
export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const { tab = "liste", sinif = "" } = await searchParams;
  const rubrics = await listRubrics(ownerId);
  const tabs = [
    { key: "liste", label: "Değerlendirmeler", href: "/kurum/degerlendirme" },
    { key: "yeni", label: "Yeni", href: "/kurum/degerlendirme?tab=yeni" },
    { key: "cetveller", label: `Puan cetvelleri (${rubrics.length})`, href: "/kurum/degerlendirme?tab=cetveller" },
  ];
  const header = <PageHeader title="Sözlü ve yazılı" sub="Puan cetveliyle yapılan sözlü, yazılı ve uygulama değerlendirmeleri. Öğretmenler telefondan girer." />;

  if (tab === "cetveller") {
    return (
      <>
        {header}
        <Tabs tabs={tabs} active={tab} />
        <RubricManager rubrics={rubrics} />
      </>
    );
  }
  if (tab === "yeni") {
    const courses = await listCourses(ownerId);
    return (
      <>
        {header}
        <Tabs tabs={tabs} active={tab} />
        <div className="max-w-lg">
          <NewAssessmentForm
            courses={courses.map((c) => ({ id: c.id, name: c.name, classroom: c.classroomName, kind: c.kind }))}
            rubrics={rubrics}
            topics={[]}
            today={ymd()}
            nextBase="/kurum/degerlendirme"
          />
        </div>
      </>
    );
  }

  const [classes, items] = await Promise.all([classroomsOf(ownerId), listAssessments(ownerId, sinif ? { classroomId: sinif } : {})]);
  return (
    <>
      {header}
      <Tabs tabs={tabs} active={tab} />
      <form className="mb-3 flex flex-wrap gap-2">
        <select name="sinif" defaultValue={sinif} className="input w-auto">
          <option value="">Tüm sınıflar</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="btn-secondary">Filtrele</button>
        <span className="ml-auto self-center text-sm text-lead">{items.length} değerlendirme</span>
      </form>
      <AssessmentList items={items} hrefBase="/kurum/degerlendirme" empty="Henüz değerlendirme yok. Öğretmenler telefondan başlatabilir ya da “Yeni” sekmesinden açabilirsiniz." />
    </>
  );
}
