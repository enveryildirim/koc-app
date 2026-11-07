import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { setExamCourse } from "@/modules/exams/server";

/** Denemeyi bir derse bağlar (hocanın sınavı). Gövde: { courseId } ya da { courseId: null } */
export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const body = (await req.json()) as Record<string, unknown>;
  await setExamCourse(await ownerOrThrow(), (await ctx.params).id, body.courseId);
});
