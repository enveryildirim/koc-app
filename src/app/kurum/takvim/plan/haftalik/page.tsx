import { requireOwner } from "@/modules/identity/server";
import { classroomsOf } from "@/modules/enrollment/server";
import { listCourses } from "@/modules/schedule/server";
import { PageHeader } from "@/shared/ui/kurum";
import WeeklyImport from "@/modules/planning/ui/WeeklyImport";

export const dynamic = "force-dynamic";

/** Haftalık plan tablosunu (hafta × ders) yıllık planlara dönüştürür. */
export default async function Page() {
  const ownerId = await requireOwner();
  const [classes, courses] = await Promise.all([classroomsOf(ownerId), listCourses(ownerId)]);
  return (
    <div>
      <PageHeader
        title="Haftalık planı içe aktar"
        sub="Müfredat haftalara dağıtılmış geliyorsa (ör. seviye müfredatı): her ders sütunu seçilen sınıflar için bir yıllık plan olur."
        back={{ href: "/kurum/takvim/plan", label: "Yıllık planlar" }}
      />
      <WeeklyImport
        classes={classes.map((c) => ({ id: c.id, name: c.name, level: c.level, courses: courses.filter((k) => k.classroomId === c.id).map((k) => k.name) }))}
      />
    </div>
  );
}
