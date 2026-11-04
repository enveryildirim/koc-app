import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteExam, updateExam } from "@/modules/exams/server";

/** Deneme ayarları + cevap anahtarı; kayıttan sonra sonuçlar yeniden hesaplanır. */
export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  await updateExam(ownerId, (await ctx.params).id, await req.json());
});

export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deleteExam(await ownerOrThrow(), (await ctx.params).id);
});
