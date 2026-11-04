import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { copyPlan } from "@/modules/planning/server";

export const POST = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  const { classroomIds } = await req.json();
  return copyPlan(ownerId, (await ctx.params).id, classroomIds);
});
