import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { saveOmrSheets, type OmrSheet } from "@/modules/online-test/server";

/** Taranan optik formları katılım olarak kaydeder. */
export const POST = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  const { sheets } = (await req.json()) as { sheets: OmrSheet[] };
  return saveOmrSheets(ownerId, (await ctx.params).id, sheets);
});
