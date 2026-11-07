import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteCourse, updateCourse } from "@/modules/schedule/server";

/** Gövde: { name?, kind?, teacherId?, external? } */
export const PATCH = api<Params<{ id: string }>>(async (req, ctx) => {
  await updateCourse(await ownerOrThrow(), (await ctx.params).id, await req.json());
});

export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deleteCourse(await ownerOrThrow(), (await ctx.params).id);
});
