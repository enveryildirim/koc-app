import { api } from "@/shared/http";
import { actorOrThrow } from "@/modules/identity/server";
import { createAssessment } from "@/modules/assessment/server";

/** Yeni değerlendirme. Gövde: { courseId, rubricId, type, date?, title?, planItemId? }. Öğretmen yalnızca kendi dersine. */
export const POST = api(async (req) => {
  const a = await actorOrThrow();
  const x = await createAssessment(a.ownerId, await req.json(), { teacherId: a.role === "TEACHER" ? a.teacherId! : undefined, by: a.teacherId });
  return { id: x.id };
});
