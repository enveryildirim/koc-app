import { api, type Params } from "@/shared/http";
import { invalid } from "@/shared/errors";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteClassroom, setClassroomMentor, updateClassroom } from "@/modules/enrollment/server";
import { findTeacher } from "@/modules/schedule/server";

/** Gövde: { name?, level?, mentorId? } — mentorId: etüt mesulü rolündeki öğretmen ya da null. */
export const PATCH = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  if (body.name !== undefined || body.level !== undefined) await updateClassroom(ownerId, id, body);
  if (body.mentorId !== undefined) {
    const mentorId = body.mentorId ? String(body.mentorId) : null;
    if (mentorId) {
      const t = await findTeacher(ownerId, mentorId);
      if (!t) throw invalid("Öğretmen bulunamadı.");
      if (t.role !== "MENTOR") throw invalid("Seçilen kişi etüt mesulü değil. Önce Öğretmenler listesinden rolünü değiştirin.");
    }
    await setClassroomMentor(ownerId, id, mentorId);
  }
});

export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  await deleteClassroom(await ownerOrThrow(), (await ctx.params).id);
});
