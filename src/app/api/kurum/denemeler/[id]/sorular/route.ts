import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { updateExamFromBank } from "@/modules/exams/server";

/** Havuzdan kurulmuş denemenin soruları ve bilgileri (oluşturmayla aynı gövde); sonucu olan denemede reddedilir. */
export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  return updateExamFromBank(ownerId, (await ctx.params).id, await req.json());
});
