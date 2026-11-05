import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { importCurriculum } from "@/modules/curriculum/server";

/** Excel'den okunmuş satırlar: { rows: CurriculumRow[], mode: "replace" | "append" } */
export const POST = api(async (req) => {
  const b = await req.json();
  return importCurriculum(await ownerOrThrow(), b.rows, b.mode);
});
