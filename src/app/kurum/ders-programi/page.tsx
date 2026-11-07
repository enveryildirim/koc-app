import Link from "next/link";
import { classroomsOf } from "@/modules/enrollment/server";
import { accessLinksOf, requireOwner } from "@/modules/identity/server";
import { listSlots, listTeachers } from "@/modules/schedule/server";
import { Empty, PageHeader, Tabs } from "@/shared/ui/kurum";
import ScheduleBoard from "@/modules/schedule/ui/ScheduleBoard";
import TeacherManager from "@/modules/schedule/ui/TeacherManager";

export const dynamic = "force-dynamic";

type SP = Promise<{ gorunum?: string; sinif?: string; ogretmen?: string }>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const tab = sp.gorunum === "ogretmen" ? "ogretmen" : sp.gorunum === "ogretmenler" ? "ogretmenler" : "sinif";

  const [classrooms, teachers] = await Promise.all([
    classroomsOf(ownerId),
    listTeachers(ownerId),
  ]);

  const tabs = [
    { key: "sinif", label: "Sınıfa göre", href: "/kurum/ders-programi" },
    { key: "ogretmen", label: "Öğretmene göre", href: "/kurum/ders-programi?gorunum=ogretmen" },
    { key: "ogretmenler", label: `Öğretmenler (${teachers.length})`, href: "/kurum/ders-programi?gorunum=ogretmenler" },
  ];

  const header = (
    <PageHeader
      title="Ders programı"
      sub="Haftalık zaman planı · derse tıklayarak düzenleyin"
      actions={<Link href="/kurum/yoklama" className="btn-primary">Yoklama al</Link>}
    />
  );

  if (tab === "ogretmenler") {
    const links = await accessLinksOf(ownerId);
    return (
      <div>
        {header}
        <Tabs tabs={tabs} active={tab} />
        <TeacherManager
          teachers={teachers.map((t) => {
            const l = links.get(t.id);
            return { id: t.id, name: t.name, branch: t.branch, role: t.role, slotCount: t.slotCount, link: l ? { token: l.token, lastUsedAt: l.lastUsedAt?.toISOString() ?? null } : null };
          })}
        />
      </div>
    );
  }

  if (!classrooms.length) {
    return (
      <div>
        {header}
        <Empty>Ders programı oluşturmak için önce “Öğrenciler” bölümünden sınıf ekleyin.</Empty>
      </div>
    );
  }

  const selClass = tab === "sinif" ? classrooms.find((c) => c.id === sp.sinif) ?? classrooms[0] : null;
  const selTeacher = tab === "ogretmen" ? teachers.find((t) => t.id === sp.ogretmen) ?? teachers[0] : null;

  const slots = await listSlots(ownerId, selClass ? { classroomId: selClass.id } : { teacherId: selTeacher?.id ?? "-" });
  const weeklyMinutes = slots.reduce((s, x) => s + minutes(x.startTime, x.endTime), 0);

  const chips = tab === "sinif"
    ? classrooms.map((c) => ({ id: c.id, label: c.name, href: `/kurum/ders-programi?sinif=${c.id}`, active: c.id === selClass?.id }))
    : teachers.map((t) => ({ id: t.id, label: `${t.name} · ${t.branch}`, href: `/kurum/ders-programi?gorunum=ogretmen&ogretmen=${t.id}`, active: t.id === selTeacher?.id }));

  return (
    <div>
      {header}
      <Tabs tabs={tabs} active={tab} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <Link
            key={c.id}
            href={c.href}
            className={`rounded-full px-3 py-1 text-sm font-medium ${c.active ? "bg-graphite text-white" : "bg-surface text-lead ring-1 ring-rule hover:bg-paper"}`}
          >
            {c.label}
          </Link>
        ))}
        <span className="ml-auto text-sm text-lead">
          Haftalık {slots.length} ders · {(weeklyMinutes / 60).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} saat
        </span>
      </div>
      {tab === "ogretmen" && !teachers.length ? (
        <Empty>Henüz öğretmen yok. “Öğretmenler” sekmesinden ekleyin.</Empty>
      ) : (
        <ScheduleBoard
          view={tab === "sinif" ? "sinif" : "ogretmen"}
          defaults={{ classroomId: selClass?.id, teacherId: selTeacher?.id }}
          classrooms={classrooms.map((c) => ({ id: c.id, name: c.name }))}
          teachers={teachers.map((t) => ({ id: t.id, name: t.name, branch: t.branch }))}
          slots={slots.map((s) => ({
            id: s.id,
            classroomId: s.classroomId,
            classroomName: s.classroom.name,
            teacherId: s.teacherId,
            teacherName: s.teacher.name,
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

function minutes(a: string, b: string) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return Math.max(0, bh * 60 + bm - (ah * 60 + am));
}
