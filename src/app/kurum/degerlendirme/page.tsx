import { redirect } from "next/navigation";
import { ymd } from "@/shared/date";
import { classroomsOf } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { listAssessments, listRubrics } from "@/modules/assessment/server";
import { listCourses } from "@/modules/schedule/server";
import { PageHeader, Tabs } from "@/shared/ui/kurum";
import AssessmentList from "@/modules/assessment/ui/AssessmentList";
import { OutlierToggle, withOutliers } from "@/shared/ui/Outliers";
import { outliersOn } from "@/shared/stats";
import NewAssessmentForm from "@/modules/assessment/ui/NewAssessmentForm";

export const dynamic = "force-dynamic";

type SP = Promise<{ tab?: string; sinif?: string; uc?: string }>;

/** Sözlü, yazılı ve uygulama değerlendirmeleri; puan cetvelleri (yönetici). */
export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const { tab = "liste", sinif = "", uc: ucParam } = await searchParams;
  const uc = outliersOn(ucParam);
  const rubrics = await listRubrics(ownerId);
  const tabs = [
    { key: "liste", label: "Değerlendirmeler", href: "/kurum/degerlendirme" },
    { key: "yeni", label: "Yeni", href: "/kurum/degerlendirme?tab=yeni" },
    { key: "cetveller", label: `Puan cetvelleri (${rubrics.length})`, href: "/kurum/puan-cetvelleri" },
  ];
  const header = <PageHeader title="Sözlü ve yazılı" sub="Puan cetveliyle yapılan sözlü, yazılı ve uygulama değerlendirmeleri. Öğretmenler telefondan girer." />;

  // Eski adres: puan cetvelleri artık kendi menü maddesinde (sekme oraya götürür)
  if (tab === "cetveller") redirect("/kurum/puan-cetvelleri");
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
        {uc && <input type="hidden" name="uc" value="1" />}
        <button className="btn-secondary">Filtrele</button>
        <OutlierToggle on={uc} href={withOutliers(`/kurum/degerlendirme${sinif ? `?sinif=${sinif}` : ""}`, !uc)} />
        <span className="ml-auto self-center text-sm text-lead">{items.length} değerlendirme</span>
      </form>
      <AssessmentList items={items} trim={uc} hrefBase="/kurum/degerlendirme" empty="Henüz değerlendirme yok. Öğretmenler telefondan başlatabilir ya da “Yeni” sekmesinden açabilirsiniz." />
    </>
  );
}
