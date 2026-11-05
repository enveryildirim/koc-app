import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteSource } from "@/modules/question-bank/server";

export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deleteSource(await ownerOrThrow(), (await ctx.params).id);
});
