import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteAttempt } from "@/modules/online-test/server";

export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deleteAttempt(await ownerOrThrow(), (await ctx.params).id);
});
