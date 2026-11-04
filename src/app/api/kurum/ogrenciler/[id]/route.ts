import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteStudent, updateStudent } from "@/modules/enrollment/server";

export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  await updateStudent(ownerId, (await ctx.params).id, await req.json());
});

export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deleteStudent(await ownerOrThrow(), (await ctx.params).id);
});
