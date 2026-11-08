import Link from "next/link";
import { classroomsOf } from "@/modules/enrollment/server";
import { accessLinksOf, getUser, requireOwner } from "@/modules/identity/server";
import { listCourses, listTeachers } from "@/modules/schedule/server";
import { PageHeader, Tabs } from "@/shared/ui/kurum";
import PersonnelManager from "@/modules/schedule/ui/PersonnelManager";

export const dynamic = "force-dynamic";

type SP = Promise<{ rol?: string; yeni?: string }>;

/**
 * Personel: kuruma girişi olan kişiler, role göre sekmelerde (KROKI.md > Roller).
 * Öğretmenler (ad + branş) · Etüt mesulleri (ad + sorumlu olduğu sınıflar, branşı yok) · Yönetici (kurum hesabı).
 * Öğrenciler ayrı sayfadadır (Öğrenciler); öğrenci ve veli girişi kişisel link / veli linkiyle.
 */
export default async function Page({ searchParams }: { searchParams: SP }) {
  const ownerId = await requireOwner();
  const { rol = "ogretmen", yeni } = await searchParams;
  const tab = rol === "mesul" || rol === "yonetici" ? rol : "ogretmen";
  const [teachers, links, classrooms, courses, user] = await Promise.all([listTeachers(ownerId), accessLinksOf(ownerId), classroomsOf(ownerId), listCourses(ownerId), getUser()]);

  const people = teachers.map((t) => {
    const l = links.get(t.id);
    return {
      id: t.id,
      name: t.name,
      branch: t.branch,
      role: t.role,
      slotCount: t.slotCount,
      link: l ? { token: l.token, lastUsedAt: l.lastUsedAt?.toISOString() ?? null } : null,
      classes: classrooms.filter((c) => c.mentorId === t.id).map((c) => ({ id: c.id, name: c.name })),
      courseCount: courses.filter((c) => c.teacherId === t.id).length,
    };
  });
  const mentors = people.filter((p) => p.role === "MENTOR");
  const plain = people.filter((p) => p.role !== "MENTOR");

  const tabs = [
    { key: "ogretmen", label: `Öğretmenler (${plain.length})`, href: "/kurum/personel" },
    { key: "mesul", label: `Etüt mesulleri (${mentors.length})`, href: "/kurum/personel?rol=mesul" },
    { key: "yonetici", label: "Yönetici", href: "/kurum/personel?rol=yonetici" },
  ];
  const addLabel = tab === "mesul" ? "+ Etüt mesulü ekle" : "+ Öğretmen ekle";
  const unassigned = classrooms.filter((c) => !c.mentorId);

  return (
    <>
      <PageHeader
        title="Personel"
        sub="Öğretmenler, etüt mesulleri ve yönetici. Öğretmen ve etüt mesulü telefondan kişisel linkle girer."
        actions={tab !== "yonetici" ? <Link href={`?${new URLSearchParams({ ...(tab === "mesul" ? { rol: "mesul" } : {}), yeni: "1" })}`} scroll={false} className="btn-primary">{addLabel}</Link> : undefined}
      />
      <Tabs tabs={tabs} active={tab} />

      {tab === "yonetici" ? (
        <div className="max-w-2xl space-y-3">
          <div className="card px-4 py-3">
            <div className="font-semibold">{user?.name}</div>
            <div className="text-sm text-lead">{user?.email} · kurum hesabı</div>
          </div>
          <p className="text-sm text-lead">
            Yönetici kurum hesabıdır; e-posta ve şifreyle girer, her şeyi yapabilir. Etüt mesulleri de yönetim panelini aynı yetkiyle kullanır
            (varsayılan olarak kendi sınıflarını görür). Birden fazla yönetici hesabı sonraki adımda.
          </p>
        </div>
      ) : (
        <>
          {tab === "mesul" && unassigned.length > 0 && classrooms.length > 0 && (
            <p className="mb-3 text-sm text-amber-700">Etüt mesulü atanmamış sınıflar: {unassigned.map((c) => c.name).join(", ")}.</p>
          )}
          <PersonnelManager
            key={tab}
            role={tab === "mesul" ? "MENTOR" : "TEACHER"}
            people={tab === "mesul" ? mentors : plain}
            classes={classrooms.map((c) => ({ id: c.id, name: c.name, mentorId: c.mentorId, mentorName: c.mentor?.name ?? null }))}
            open={yeni === "1"}
          />
        </>
      )}
    </>
  );
}
