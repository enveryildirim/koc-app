import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { sourceFile } from "@/modules/question-bank/server";

/** Kaynağın n. dosyası (0 tabanlı); kesme ekranı tarayıcıda açar. */
export const GET = api<Params<{ id: string; n: string }>>(async (_req, ctx) => {
  const { id, n } = await ctx.params;
  const f = await sourceFile(await ownerOrThrow(), id, Number(n) || 0);
  return new Response(new Uint8Array(f.data), { headers: { "Content-Type": f.type, "Cache-Control": "private, max-age=3600" } });
});
