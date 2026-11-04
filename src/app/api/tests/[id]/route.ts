import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteTest, saveTest } from "@/modules/online-test/server";

export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  return saveTest(ownerId, (await ctx.params).id, await req.json());
});

export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deleteTest(await ownerOrThrow(), (await ctx.params).id);
});
