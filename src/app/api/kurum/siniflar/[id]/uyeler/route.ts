import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { addClassMember } from "@/modules/enrollment/server";

/** Öğrenciyi sınıfa ek üye yapar. Gövde: { studentId } */
export const POST = api<Params<{ id: string }>>(async (req, ctx) => {
  const body = (await req.json()) as Record<string, unknown>;
  await addClassMember(await ownerOrThrow(), (await ctx.params).id, String(body.studentId ?? ""));
});
