import Link from "next/link";
import { prisma } from "@/lib/db";
import { classroomsOf, requireOwner } from "@/lib/kurum";
import { Empty, PageHeader, Tabs } from "@/components/kurum/ui";
import ScheduleBoard from "@/components/kurum/program/ScheduleBoard";
import TeacherManager from "@/components/kurum/program/TeacherManager";

export const dynamic = "force-dynamic";

type SP = Promise<{ gorunum?: string; sinif?: string; ogretmen?: string }>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const sp = await searchParams;
  const tab = sp.gorunum === "ogretmen" ? "ogretmen" : sp.gorunum === "ogretmenler" ? "ogretmenler" : "sinif";

  const [classrooms, teachers] = await Promise.all([
    classroomsOf(ownerId),
    prisma.teacher.findMany({ where: { ownerId }, orderBy: { name: "asc" }, include: { _count: { select: { slots: true } } } }),
  ]);

  const tabs = [
    { key: "sinif", label: "Sınıfa göre", href: "/kurum/ders-programi" },
    { key: "ogretmen", label: "Öğretmene göre", href: "/kurum/ders-programi?gorunum=ogretmen" },
    { key: "ogretmenler", label: `Öğretmenler (${teachers.length})`, href: "/kurum/ders-programi?gorunum=ogretmenler" },
  ];

  const header = (
    <PageHeader
      title="Ders Programı"
      sub="Haftalık zaman planı · derse tıklayarak düzenleyin"
      actions={<Link href="/kurum/yoklama" className="btn-primary">✅ Yoklama al</Link>}
    />
  );

  if (tab === "ogretmenler") {
    return (
      <div>
        {header}
        <Tabs tabs={tabs} active={tab} />
        <TeacherManager teachers={teachers.map((t) => ({ id: t.id, name: t.name, branch: t.branch, slotCount: t._count.slots }))} />
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

  const slots = await prisma.scheduleSlot.findMany({
    where: { ownerId, ...(selClass ? { classroomId: selClass.id } : { teacherId: selTeacher?.id ?? "-" }) },
    include: { classroom: true, teacher: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
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
            className={`rounded-full px-3 py-1 text-sm font-medium ${c.active ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {c.label}
          </Link>
        ))}
        <span className="ml-auto text-sm text-slate-500">
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
