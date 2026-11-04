import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteResult } from "@/modules/exams/server";

export const DELETE = api<Params<{ id: string; resultId: string }>>(async (_req, ctx) => {
  const { id, resultId } = await ctx.params;
  await deleteResult(await ownerOrThrow(), id, resultId);
});
