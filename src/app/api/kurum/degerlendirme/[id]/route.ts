import { api, type Params } from "@/shared/http";
import { actorOrThrow } from "@/modules/identity/server";
import { deleteAssessment } from "@/modules/assessment/server";

export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  const a = await actorOrThrow();
  await deleteAssessment(a.ownerId, (await ctx.params).id, { teacherId: a.role === "TEACHER" ? a.teacherId! : undefined });
});
