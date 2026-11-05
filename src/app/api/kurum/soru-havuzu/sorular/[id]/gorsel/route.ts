import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { itemImage } from "@/modules/question-bank/server";

export const GET = api<Params<{ id: string }>>(async (_req, ctx) => {
  const f = await itemImage(await ownerOrThrow(), (await ctx.params).id);
  return new Response(new Uint8Array(f.data), { headers: { "Content-Type": f.type, "Cache-Control": "private, max-age=86400, immutable" } });
});
