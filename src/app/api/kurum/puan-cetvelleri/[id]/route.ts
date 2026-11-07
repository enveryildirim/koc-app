import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteRubric, updateRubric } from "@/modules/assessment/server";

export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  await updateRubric(await ownerOrThrow(), (await ctx.params).id, await req.json());
});

export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deleteRubric(await ownerOrThrow(), (await ctx.params).id);
});
