import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteClassroom } from "@/modules/enrollment/server";

export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deleteClassroom(await ownerOrThrow(), (await ctx.params).id);
});
