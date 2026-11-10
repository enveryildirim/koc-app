import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { setOmrStudentNo } from "@/modules/exams/server";

/** Optik form ayarı. Gövde: { studentNo: boolean } — öğrenci numarası alanı olsun mu */
export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const body = (await req.json()) as Record<string, unknown>;
  await setOmrStudentNo(await ownerOrThrow(), (await ctx.params).id, body.studentNo);
});
