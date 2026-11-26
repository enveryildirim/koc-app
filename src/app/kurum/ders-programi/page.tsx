import Link from "next/link";
import { redirect } from "next/navigation";
import { classroomsOf } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { listCourses, listSlots, listTeachers, scheduleClashes, syncCourses, type Clash } from "@/modules/schedule/server";
import { teacherSub } from "@/modules/schedule";
import { Empty, PageHeader, Tabs } from "@/shared/ui/kurum";
import ScheduleBoard from "@/modules/schedule/ui/ScheduleBoard";

export const dynamic = "force-dynamic";

type SP = Promise<{ gorunum?: string; sinif?: string; ogretmen?: string }>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  // Eski adres: öğretmenler artık kendi menü maddesinde
  if (sp.gorunum === "ogretmenler") redirect("/kurum/personel");
  const tab = sp.gorunum === "ogretmen" ? "ogretmen" : "sinif";

  await syncCourses(ownerId); // derse bağlanmamış eski program satırları
  const [classrooms, teachers, clashes, courses] = await Promise.all([
    classroomsOf(ownerId),
    listTeachers(ownerId),
    scheduleClashes(ownerId),
    listCourses(ownerId),
  ]);

  const tabs = [
    { key: "sinif", label: "Sınıfa göre", href: "/kurum/ders-programi" },
    { key: "ogretmen", label: "Öğretmene göre", href: "/kurum/ders-programi?gorunum=ogretmen" },
  ];

  const header = (
    <PageHeader
      title="Ders programı"
      sub="Haftalık zaman planı · derse tıklayarak düzenleyin"
      actions={<Link href="/kurum/yoklama" className="btn-primary">Yoklama al</Link>}
    />
  );

  if (!classrooms.length) {
    return (
      <div>
        {header}
        <Empty>Ders programı oluşturmak için önce <Link href="/kurum/siniflar?yeni=1" className="font-semibold text-brand-600">Sınıflar</Link> sayfasından sınıf ekleyin.</Empty>
      </div>
    );
  }

  const selClass = tab === "sinif" ? classrooms.find((c) => c.id === sp.sinif) ?? classrooms[0] : null;
  const selTeacher = tab === "ogretmen" ? teachers.find((t) => t.id === sp.ogretmen) ?? teachers[0] : null;

  const slots = await listSlots(ownerId, selClass ? { classroomId: selClass.id } : { teacherId: selTeacher?.id ?? "-" });
  const weeklyMinutes = slots.reduce((s, x) => s + minutes(x.startTime, x.endTime), 0);

  const chips = tab === "sinif"
    ? classrooms.map((c) => ({ id: c.id, label: c.name, href: `/kurum/ders-programi?sinif=${c.id}`, active: c.id === selClass?.id }))
    : teachers.map((t) => ({ id: t.id, label: `${t.name} · ${teacherSub(t)}`, href: `/kurum/ders-programi?gorunum=ogretmen&ogretmen=${t.id}`, active: t.id === selTeacher?.id }));

  return (
    <div>
      {header}
      <ClashList clashes={clashes} />
      <Tabs tabs={tabs} active={tab} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <Link
            key={c.id}
            href={c.href}
            className={`rounded-full px-3 py-1 text-sm font-medium ${c.active ? "bg-graphite text-surface" : "bg-surface text-lead ring-1 ring-rule hover:bg-paper"}`}
          >
            {c.label}
          </Link>
        ))}
        <span className="ml-auto text-sm text-lead">
          Haftalık {slots.length} ders · {(weeklyMinutes / 60).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} saat
        </span>
      </div>
      {tab === "ogretmen" && !teachers.length ? (
        <Empty>Henüz öğretmen yok. <Link href="/kurum/personel?yeni=1" className="font-semibold text-brand-600">Personel</Link> sayfasından ekleyin.</Empty>
      ) : (
        <ScheduleBoard
          view={tab === "sinif" ? "sinif" : "ogretmen"}
          defaults={{ classroomId: selClass?.id, teacherId: selTeacher?.id }}
          classrooms={classrooms.map((c) => ({ id: c.id, name: c.name }))}
          courses={courses.map((c) => ({ id: c.id, classroomId: c.classroomId, name: c.name, kind: c.kind, teacherId: c.teacherId }))}
          teachers={teachers.map((t) => ({ id: t.id, name: t.name, branch: t.branch, role: t.role }))}
          clash={Object.fromEntries(
            clashes.flatMap((c) => c.slotIds.map((id) => [id, c.hard ? "hard" : "soft"] as const)).sort((a, b) => (a[1] === "hard" ? 1 : 0) - (b[1] === "hard" ? 1 : 0)),
          )}
          slots={slots.map((s) => ({
            id: s.id,
            classroomId: s.classroomId,
            classroomName: s.classroom.name,
            teacherId: s.teacherId,
            teacherName: s.teacher.name,
            courseId: s.courseId,
            subject: s.subject,
            lessonType: s.lessonType,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          }))}
        />
      )}
    </div>
  );
}

/** Programdaki çakışmalar: kesinler kırmızı, uyarılar sarı. Her satır çakışmanın görüldüğü sınıfın programına götürür. */
function ClashList({ clashes }: { clashes: Clash[] }) {
  if (!clashes.length) return null;
  const hard = clashes.filter((c) => c.hard).length;
  const soft = clashes.length - hard;
  const title = [hard ? `${hard} çakışma` : null, soft ? `${soft} uyarı` : null].filter(Boolean).join(" · ");
  return (
    <details open={clashes.length <= 5} className={`mb-4 rounded-lg px-3.5 py-2.5 text-sm ring-1 ${hard ? "bg-red-50 ring-red-200" : "bg-amber-50 ring-amber-200"}`}>
      <summary className={`cursor-pointer font-semibold ${hard ? "text-red-800" : "text-amber-800"}`}>
        Programda {title}
      </summary>
      <ul className="mt-2 space-y-1">
        {clashes.map((c) => (
          <li key={c.message} className="flex gap-2">
            <span className={`mt-0.5 shrink-0 text-xs font-semibold ${c.hard ? "text-red-700" : "text-amber-700"}`}>{c.hard ? "Çakışma" : "Uyarı"}</span>
            <Link href={`/kurum/ders-programi?sinif=${c.classroomId}`} className="text-graphite hover:underline">{c.message}</Link>
          </li>
        ))}
      </ul>
      {hard > 0 && <p className="mt-2 text-[13px] text-lead">Çakışan dersler programda kırmızı çerçeveli. Derse tıklayıp saatini ya da öğretmenini değiştirin veya silin.</p>}
    </details>
  );
}

function minutes(a: string, b: string) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return Math.max(0, bh * 60 + bm - (ah * 60 + am));
}
