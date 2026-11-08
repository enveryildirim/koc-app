import Link from "next/link";
import { classroomsOf } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { listCourses } from "@/modules/schedule/server";
import { PageHeader } from "@/shared/ui/kurum";
import ClassManager from "@/modules/enrollment/ui/ClassManager";

export const dynamic = "force-dynamic";

/** Sınıflar: liste, ekleme (yan panel, `?yeni=1`), silme. Sınıfa tıklayınca dersleri, üyeleri ve etüt mesulü. */
export default async function Page({ searchParams }: { searchParams: Promise<{ yeni?: string }> }) {
  const ownerId = await requireOwner();
  const { yeni } = await searchParams;
  const [classes, courses] = await Promise.all([classroomsOf(ownerId), listCourses(ownerId)]);
  const courseCount = (id: string) => courses.filter((c) => c.classroomId === id).length;
  return (
    <>
      <PageHeader
        title="Sınıflar"
        sub="Sınıfa tıklayarak derslerini, öğrencilerini ve etüt mesulünü düzenleyin."
        actions={<Link href="?yeni=1" scroll={false} className="btn-primary">+ Yeni sınıf</Link>}
      />
      <ClassManager
        open={yeni === "1"}
        classes={classes.map((c) => ({
          id: c.id,
          name: c.name,
          level: c.level,
          students: c.studentCount,
          members: c.memberCount,
          courses: courseCount(c.id),
          mentor: c.mentor?.name ?? null,
        }))}
      />
    </>
  );
}
