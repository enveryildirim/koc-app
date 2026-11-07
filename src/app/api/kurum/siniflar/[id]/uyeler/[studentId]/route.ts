import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { removeClassMember } from "@/modules/enrollment/server";

export const DELETE = api<Params<{ id: string; studentId: string }>>(async (_req, ctx) => {
  const { id, studentId } = await ctx.params;
  await removeClassMember(await ownerOrThrow(), id, studentId);
});
