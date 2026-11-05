import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { deleteCurriculumSet, saveCurriculumSet } from "@/modules/curriculum/server";

/** Bir setin tamamını kaydet: { subject, grade, rows: [{ unit, topic, code, outcome, weeks }] } */
export const PUT = api(async (req) => {
  const b = await req.json();
  return saveCurriculumSet(await ownerOrThrow(), b.subject, b.grade, b.rows);
});

/** Seti sil: { subject, grade } */
export const DELETE = api(async (req) => {
  const b = await req.json();
  return deleteCurriculumSet(await ownerOrThrow(), b.subject, b.grade);
});
