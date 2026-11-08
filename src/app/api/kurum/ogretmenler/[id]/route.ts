import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { setMentorClasses } from "@/modules/enrollment/server";
import { deleteTeacher, findTeacher, updateTeacher } from "@/modules/schedule/server";

/** Ad, rol, branş. Rolü öğretmene dönen kişinin etüt mesulü olduğu sınıflar boşa çıkar. */
export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  const { id } = await ctx.params;
  await updateTeacher(ownerId, id, await req.json());
  if ((await findTeacher(ownerId, id))?.role !== "MENTOR") await setMentorClasses(ownerId, id, []);
});

export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deleteTeacher(await ownerOrThrow(), (await ctx.params).id);
});
