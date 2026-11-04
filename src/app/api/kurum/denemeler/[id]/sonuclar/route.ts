import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { importResults } from "@/modules/exams/server";

/** Sonuç kaydı (optik tarama `sheets` veya TXT / elle `rows`); biçimler için bkz. importResults. */
export const POST = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  return importResults(ownerId, (await ctx.params).id, await req.json());
});
