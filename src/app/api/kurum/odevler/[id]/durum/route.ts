import { api, type Params } from "@/shared/http";
import { actorOrThrow } from "@/modules/identity/server";
import { setHomeworkStatuses } from "@/modules/homework/server";

/** Öğrenci durumlarını günceller (tek ya da toplu). Öğretmen yalnızca kendi dersinin ödevinde. */
export const PATCH = api<Params<{ id: string }>>(async (req, ctx) => {
  const a = await actorOrThrow();
  const { id } = await ctx.params;
  const { updates } = (await req.json()) as { updates?: unknown };
  await setHomeworkStatuses(a.ownerId, id, updates, { teacherId: a.role === "TEACHER" ? a.teacherId! : undefined });
});
