import { api, type Params } from "@/shared/http";
import { ownerOrThrow, revokeApiKey } from "@/modules/identity/server";

/** Anahtarı iptal et (silinmez; listede "iptal edildi" görünür). */
export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => revokeApiKey(await ownerOrThrow(), (await ctx.params).id));
