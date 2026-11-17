import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { setSolutionsOpen } from "@/modules/exams/server";

/** Çözümleri yayınla / kapat: { open: boolean }. */
export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  const body = (await req.json()) as { open?: unknown };
  await setSolutionsOpen(ownerId, (await ctx.params).id, body.open === true);
});
