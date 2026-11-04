import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deletePlan, updatePlan } from "@/modules/planning/server";

export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  await updatePlan(ownerId, (await ctx.params).id, await req.json());
});

export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deletePlan(await ownerOrThrow(), (await ctx.params).id);
});
