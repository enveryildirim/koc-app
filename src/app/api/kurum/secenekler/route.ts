import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { classroomsOf } from "@/modules/enrollment/server";
import { listTeachers } from "@/modules/schedule/server";

/** "+ Ekle" penceresi için seçenekler: sınıflar ve öğretmenler (ad sırasıyla). */
export const GET = api(async () => {
  const ownerId = await ownerOrThrow();
  const [classes, teachers] = await Promise.all([classroomsOf(ownerId), listTeachers(ownerId)]);
  return {
    classes: classes.map((c) => ({ id: c.id, name: c.name })),
    teachers: teachers.map((t) => ({ id: t.id, name: t.name, branch: t.branch })),
  };
});
