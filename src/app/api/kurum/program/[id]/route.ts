import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteSlot, updateSlot } from "@/modules/schedule/server";

export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  await updateSlot(ownerId, (await ctx.params).id, await req.json());
});

/** Programdan siler; geçmiş yoklamalar (LessonSession) korunur (slotId null olur). */
export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deleteSlot(await ownerOrThrow(), (await ctx.params).id);
});
