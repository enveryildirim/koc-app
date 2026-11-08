import { classroomsOf } from "@/modules/enrollment/server";
import { requireOwner } from "@/modules/identity/server";
import { PageHeader } from "@/shared/ui/kurum";
import ClassManager from "@/modules/enrollment/ui/ClassManager";

export const dynamic = "force-dynamic";

/** Sınıflar: liste, ekleme, silme. Sınıfa tıklayınca dersleri, üyeleri ve etüt mesulü. */
export default async function Page() {
  const ownerId = await requireOwner();
  const classes = await classroomsOf(ownerId);
  return (
    <>
      <PageHeader title="Sınıflar" sub="Sınıfa tıklayarak derslerini, öğrencilerini ve etüt mesulünü düzenleyin." />
      <ClassManager classes={classes.map((c) => ({ id: c.id, name: c.name, level: c.level, students: c.studentCount, members: c.memberCount, mentor: c.mentor?.name ?? null }))} />
    </>
  );
}
