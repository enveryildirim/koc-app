import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { setTopicDone } from "@/modules/planning/server";

export const POST = api<Params<{ itemId: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  await setTopicDone(ownerId, (await ctx.params).itemId, await req.json());
});
