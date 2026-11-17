import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { syncExamKey } from "@/modules/exams/server";

/** Cevap anahtarını havuzdaki güncel cevaplarla eşitler; sonuçlar yeniden puanlanır. */
export const POST = api<Params<{ id: string }>>(async (_req, ctx) => {
  return syncExamKey(await ownerOrThrow(), (await ctx.params).id);
});
