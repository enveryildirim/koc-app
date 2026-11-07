import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { createCourse } from "@/modules/schedule/server";

/** Yeni ders. Gövde: { classroomId, name, kind, teacherId?, external? } */
export const POST = api(async (req) => {
  const c = await createCourse(await ownerOrThrow(), await req.json());
  return { id: c.id };
});
