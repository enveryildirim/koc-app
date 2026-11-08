import { api, type Params } from "@/shared/http";
import { invalid, notFound } from "@/shared/errors";
import { ownerOrThrow } from "@/modules/identity/server";
import { setMentorClasses } from "@/modules/enrollment/server";
import { findTeacher } from "@/modules/schedule/server";

/** Etüt mesulünün sınıfları. Gövde: { classroomIds: string[] } — verilenler ona atanır, diğerleri bırakılır. */
export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  const { id } = await ctx.params;
  const t = await findTeacher(ownerId, id);
  if (!t) throw notFound();
  if (t.role !== "MENTOR") throw invalid("Sınıf yalnızca etüt mesulüne atanır.");
  const body = (await req.json()) as { classroomIds?: unknown };
  if (!Array.isArray(body.classroomIds)) throw invalid("Geçersiz istek.");
  await setMentorClasses(ownerId, t.id, body.classroomIds as string[]);
});
