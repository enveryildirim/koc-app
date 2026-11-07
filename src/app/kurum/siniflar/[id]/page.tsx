import Link from "next/link";
import { notFound } from "next/navigation";
import { findClassroom, listStudents } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { listCourses, listTeachers, syncCourses } from "@/modules/schedule/server";
import { PageHeader } from "@/shared/ui/kurum";
import { classAssessmentSummary, fmtPercent } from "@/modules/assessment/server";
import ClassMentor from "@/modules/enrollment/ui/ClassMentor";
import ClassMembers from "@/modules/enrollment/ui/ClassMembers";
import CourseManager from "@/modules/schedule/ui/CourseManager";

export const dynamic = "force-dynamic";

/** Sınıf sayfası: etüt mesulü, dersler ve öğrenciler (ana sınıf + ek üyeler). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const cls = await findClassroom(ownerId, id);
  if (!cls) notFound();

  await syncCourses(ownerId); // programdan gelen ama derse bağlanmamış satırlar (eski veri)
  const [courses, teachers, inClass, all, summary] = await Promise.all([
    listCourses(ownerId, { classroomId: cls.id }),
    listTeachers(ownerId),
    listStudents(ownerId, { inClass: cls.id }, "name"),
    listStudents(ownerId, { external: false }, "name"),
    classAssessmentSummary(ownerId, cls.id),
  ]);

  const row = (s: (typeof all)[number]) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, studentNo: s.studentNo, homeClass: s.classroom?.name ?? null });
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "tr");
  const own = inClass.filter((s) => s.classroomId === cls.id).map(row).sort(byName);
  const members = inClass.filter((s) => s.classroomId !== cls.id).map(row).sort(byName);
  const inIds = new Set(inClass.map((s) => s.id));
  const candidates = all.filter((s) => !inIds.has(s.id)).map(row);

  const sub = [
    cls.level ? `Düzey ${cls.level}` : null,
    `${own.length} öğrenci`,
    members.length ? `${members.length} ek üye` : null,
    `${courses.length} ders`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <PageHeader
        title={cls.name}
        sub={sub}
        back={{ href: "/kurum/ogrenciler?tab=siniflar", label: "Sınıflar" }}
        actions={<Link href={`/kurum/ders-programi?sinif=${cls.id}`} className="btn-secondary">Ders programı</Link>}
      />
      <div className="card max-w-md p-3.5">
        <ClassMentor
          classroomId={cls.id}
          mentorId={cls.mentorId}
          mentors={teachers.filter((t) => t.role === "MENTOR").map((t) => ({ id: t.id, name: t.name }))}
        />
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <CourseManager
          classroomId={cls.id}
          courses={courses}
          teachers={teachers.map((t) => ({ id: t.id, name: t.name, role: t.role }))}
          notes={Object.fromEntries(
            courses.filter((c) => c.kind !== "STUDY").map((c) => {
              const s = summary.get(c.id);
              if (!s) return [c.id, { text: "Son 30 günde sözlü / yazılı yok", warn: true }];
              return [c.id, {
                text: `Son 30 gün: ${s.count} değerlendirme · ort. ${fmtPercent(s.avg)}${s.unassessed ? ` · ${s.unassessed} öğrenci değerlendirilmedi` : ""}`,
                warn: s.unassessed > 0,
              }];
            }),
          )}
        />
        <ClassMembers classroomId={cls.id} own={own} members={members} candidates={candidates} />
      </div>
    </div>
  );
}
