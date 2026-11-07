import Link from "next/link";
import { requireStaff } from "@/modules/identity/server";
import { listAssessments } from "@/modules/assessment/server";
import { COURSE_KINDS } from "@/modules/schedule";
import AssessmentList from "@/modules/assessment/ui/AssessmentList";
import { staffCourses } from "../staff-courses";

export const dynamic = "force-dynamic";

/** Öğretmenin değerlendirmeleri: dersleri (yeni başlatmak için) ve son değerlendirmeler. */
export default async function Page() {
  const me = await requireStaff();
  const courses = await staffCourses(me);
  const items = courses.length ? await listAssessments(me.ownerId, { courseIds: courses.map((c) => c.id) }, 30) : [];

  return (
    <div className="space-y-4">
      <section>
        <h1 className="mb-2 font-display text-lg font-bold">Sözlü ve yazılı</h1>
        <p className="mb-2 text-[13px] text-lead">Derse dokunun, değerlendirmeyi başlatın ve öğrenci öğrenci puan girin.</p>
        <ul className="card divide-y divide-rule/70">
          {courses.map((c) => (
            <li key={c.id}>
              <Link href={`/ogretmen/degerlendirme/yeni?ders=${c.id}`} className="flex items-center gap-3 px-3.5 py-2.5 active:bg-paper">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{c.name}</span>
                    <span className={`badge ${COURSE_KINDS[c.kind]?.cls ?? ""}`}>{COURSE_KINDS[c.kind]?.label}</span>
                    {c.external && <span className="badge bg-zinc-100 text-zinc-700">Dışarıda</span>}
                  </span>
                  <span className="text-[13px] text-lead">{c.classroomName}</span>
                </span>
                <span className="text-sm font-semibold text-brand-600">Başlat ›</span>
              </Link>
            </li>
          ))}
          {courses.length === 0 && <li className="px-3.5 py-4 text-sm text-lead">Size atanmış ders yok.</li>}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Son değerlendirmeler</h2>
        <AssessmentList items={items} hrefBase="/ogretmen/degerlendirme" empty="Henüz değerlendirme yok." />
      </section>
    </div>
  );
}
