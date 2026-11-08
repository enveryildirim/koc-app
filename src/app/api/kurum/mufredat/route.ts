import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { relinkPlans } from "@/modules/planning/server";
import { deleteCurriculumSet, saveCurriculumSet } from "@/modules/curriculum/server";

/** Bir setin tamamını kaydet: { subject, grade, rows: [{ unit, topic, code, outcome, weeks }] } */
export const PUT = api(async (req) => {
  const b = await req.json();
  const ownerId = await ownerOrThrow();
  const r = await saveCurriculumSet(ownerId, b.subject, b.grade, b.rows);
  for (const s of r.subjects) await relinkPlans(ownerId, s);
  return r;
});

/** Seti sil: { subject, grade } */
export const DELETE = api(async (req) => {
  const b = await req.json();
  return deleteCurriculumSet(await ownerOrThrow(), b.subject, b.grade);
});
