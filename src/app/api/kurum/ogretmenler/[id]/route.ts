import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteTeacher, updateTeacher } from "@/modules/schedule/server";

export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  await updateTeacher(ownerId, (await ctx.params).id, await req.json());
});

export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deleteTeacher(await ownerOrThrow(), (await ctx.params).id);
});
