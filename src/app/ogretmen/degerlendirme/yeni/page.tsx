import Link from "next/link";
import { notFound } from "next/navigation";
import { ymd } from "@/shared/date";
import { requireStaff } from "@/modules/identity/server";
import { listRubrics } from "@/modules/assessment/server";
import { topicsForLesson } from "@/modules/planning/server";
import NewAssessmentForm from "@/modules/assessment/ui/NewAssessmentForm";
import { staffCourses } from "../../staff-courses";

export const dynamic = "force-dynamic";

/** Yeni değerlendirme (telefon). `?ders=` ders kimliği. */
export default async function Page({ searchParams }: { searchParams: Promise<{ ders?: string }> }) {
  const me = await requireStaff();
  const { ders } = await searchParams;
  const courses = await staffCourses(me);
  const course = courses.find((c) => c.id === ders);
  if (!course) notFound();
  const today = ymd();
  const [rubrics, plan] = await Promise.all([listRubrics(me.ownerId), topicsForLesson(me.ownerId, course.classroomId, course.name, today, 8)]);

  return (
    <div className="space-y-3">
      <div>
        <Link href="/ogretmen/degerlendirme" className="text-[13px] text-lead">‹ Sözlü ve yazılı</Link>
        <h1 className="font-display text-xl font-bold leading-tight">{course.name} · {course.classroomName}</h1>
        <p className="text-[13px] text-lead">Yeni değerlendirme</p>
      </div>
      <NewAssessmentForm
        courses={[{ id: course.id, name: course.name, classroom: course.classroomName, kind: course.kind }]}
        courseId={course.id}
        rubrics={rubrics}
        topics={(plan?.items ?? []).map((t) => ({ id: t.id, topic: t.topic, current: t.state === "current" }))}
        today={today}
        nextBase="/ogretmen/degerlendirme"
      />
    </div>
  );
}
