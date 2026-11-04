import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { setHomeworkStatuses } from "@/modules/homework/server";

/** Öğrenci durumlarını günceller (tek ya da toplu). */
export const PATCH = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  const { id } = await ctx.params;
  const { updates } = (await req.json()) as { updates?: unknown };
  await setHomeworkStatuses(ownerId, id, updates);
});
