import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteSession } from "@/modules/schedule/server";

/** Ders oturumunu ve yoklamasını siler. */
export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deleteSession(await ownerOrThrow(), (await ctx.params).id);
});
