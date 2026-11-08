import Link from "next/link";
import { notFound } from "next/navigation";
import { findClassroom, listStudents } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { listCourses, listTeachers, syncCourses } from "@/modules/schedule/server";
import { PageHeader } from "@/shared/ui/kurum";
import { classAssessmentSummary, fmtPercent } from "@/modules/assessment/server";
import ClassMentor from "@/modules/enrollment/ui/ClassMentor";
import ClassMembers from "@/modules/enrollment/ui/ClassMembers";
import { COURSE_KINDS, type CourseRow } from "@/modules/schedule";

export const dynamic = "force-dynamic";

/**
 * Sınıf sayfası: etüt mesulü, dersler (salt okunur; ekleme / düzenleme Yönetim → Dersler'de) ve öğrenciler (ana sınıf + ek üyeler).
 */
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
        back={{ href: "/kurum/siniflar", label: "Sınıflar" }}
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
        <CourseList
          classroomId={cls.id}
          courses={courses}
          notes={Object.fromEntries(
            courses.filter((c) => c.kind !== "STUDY" && c.kind !== "PREP").map((c) => {  // hazırlık dersleri denemeyle ölçülür
              const s = summary.get(c.id);
              // 30 günden yeni derste değerlendirme olmaması beklenir: uyarı değil, bilgi (her şey sarı olunca hiçbiri öne çıkmıyor)
              if (!s) return [c.id, isNew(c) ? { text: "Henüz değerlendirme yok" } : { text: "Son 30 günde sözlü / yazılı yok", warn: true }];
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

const DAY = 24 * 60 * 60 * 1000;
const isNew = (c: CourseRow) => Date.now() - new Date(c.createdAt).getTime() < 30 * DAY;
const hours = (min: number) => (min / 60).toLocaleString("tr-TR", { maximumFractionDigits: 1 });

/** Sınıfın dersleri (salt okunur). Her ders Dersler sayfasında düzenleme panelini açar. */
function CourseList({ classroomId, courses, notes }: { classroomId: string; courses: CourseRow[]; notes: Record<string, { text: string; warn?: boolean }> }) {
  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-rule/70 px-3.5 py-2.5">
        <h2 className="font-semibold">Dersler <span className="font-normal text-lead">({courses.length})</span></h2>
        <Link href={`/kurum/dersler?sinif=${classroomId}`} className="text-sm font-medium text-brand-600 hover:underline">Dersleri düzenle</Link>
      </div>
      <ul className="divide-y divide-rule/70">
        {courses.map((c) => (
          <li key={c.id}>
            <Link href={`/kurum/dersler?sinif=${classroomId}&ders=${c.id}`} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-paper active:bg-paper">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{c.name}</span>
                  <span className={`badge ${COURSE_KINDS[c.kind]?.cls ?? ""}`}>{COURSE_KINDS[c.kind]?.label ?? c.kind}</span>
                  {c.external && <span className="badge bg-zinc-100 text-zinc-700">Dışarıda</span>}
                </span>
                <span className="block text-[13px] text-lead">{c.teacherName ?? "Sorumlu yok"}</span>
                {notes[c.id] && <span className={`block text-[12.5px] ${notes[c.id].warn ? "text-amber-700" : "text-lead"}`}>{notes[c.id].text}</span>}
              </span>
              <span className="shrink-0 text-right text-[13px] text-lead">
                {c.slotCount ? <span className="num">{c.slotCount} saat · {hours(c.weeklyMinutes)} sa/hafta</span> : "Programda yok"}
              </span>
            </Link>
          </li>
        ))}
        {courses.length === 0 && (
          <li className="px-3.5 py-4 text-sm text-lead">
            Henüz ders yok.{" "}
            <Link href={`/kurum/dersler?sinif=${classroomId}&yeni=1`} className="font-medium text-brand-600 hover:underline">Ders ekleyin</Link>.
          </li>
        )}
      </ul>
    </section>
  );
}
