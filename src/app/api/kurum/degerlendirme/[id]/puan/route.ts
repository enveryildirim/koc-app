import { api, type Params } from "@/shared/http";
import { actorOrThrow } from "@/modules/identity/server";
import { saveScore } from "@/modules/assessment/server";

/** Öğrencinin puanı. Gövde: { studentId, scores: number[], note?, absent? } ya da { studentId, clear: true } */
export const POST = api<Params<{ id: string }>>(async (req, ctx) => {
  const a = await actorOrThrow();
  return saveScore(a.ownerId, (await ctx.params).id, await req.json(), { teacherId: a.role === "TEACHER" ? a.teacherId! : undefined });
});
