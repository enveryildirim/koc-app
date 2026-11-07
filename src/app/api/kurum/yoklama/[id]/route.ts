import { api, type Params } from "@/shared/http";
import { actorOrThrow } from "@/modules/identity/server";
import { deleteSession } from "@/modules/schedule/server";

/** Ders oturumunu ve yoklamasını siler. Öğretmen yalnızca kendi dersini silebilir. */
export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  const a = await actorOrThrow();
  await deleteSession(a.ownerId, (await ctx.params).id, { teacherId: a.role === "TEACHER" ? a.teacherId! : undefined });
});
