import { api, type Params } from "@/shared/http";
import { actorOrThrow } from "@/modules/identity/server";
import { setTopicDone } from "@/modules/planning/server";

/** Konuyu işlendi / işlenmedi yapar. Öğretmen yalnızca girdiği sınıf + dersin planında. */
export const POST = api<Params<{ itemId: string }>>(async (req, ctx) => {
  const a = await actorOrThrow();
  await setTopicDone(a.ownerId, (await ctx.params).itemId, await req.json(), { teacherId: a.role === "TEACHER" ? a.teacherId! : undefined });
});
