import Link from "next/link";
import { accessLinksOf, requireOwner } from "@/modules/identity/server";
import { listTeachers } from "@/modules/schedule/server";
import { PageHeader } from "@/shared/ui/kurum";
import TeacherManager from "@/modules/schedule/ui/TeacherManager";

export const dynamic = "force-dynamic";

/** Öğretmenler ve etüt mesulleri: liste, ekleme (yan panel, `?yeni=1`), rol, kişisel giriş linki. */
export default async function Page({ searchParams }: { searchParams: Promise<{ yeni?: string }> }) {
  const ownerId = await requireOwner();
  const { yeni } = await searchParams;
  const [teachers, links] = await Promise.all([listTeachers(ownerId), accessLinksOf(ownerId)]);
  return (
    <>
      <PageHeader
        title="Öğretmenler"
        sub="Öğretmen ve etüt mesulleri; telefondan giriş için kişisel linklerini paylaşın."
        actions={<Link href="?yeni=1" scroll={false} className="btn-primary">+ Öğretmen ekle</Link>}
      />
      <TeacherManager
        open={yeni === "1"}
        teachers={teachers.map((t) => {
          const l = links.get(t.id);
          return { id: t.id, name: t.name, branch: t.branch, role: t.role, slotCount: t.slotCount, link: l ? { token: l.token, lastUsedAt: l.lastUsedAt?.toISOString() ?? null } : null };
        })}
      />
    </>
  );
}
