import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { relinkPlans } from "@/modules/planning/server";
import { importCurriculum } from "@/modules/curriculum/server";

/** Excel'den okunmuş satırlar: { rows: CurriculumRow[], mode: "replace" | "append" } */
export const POST = api(async (req) => {
  const b = await req.json();
  const ownerId = await ownerOrThrow();
  const r = await importCurriculum(ownerId, b.rows, b.mode);
  // Yıllık plan satırlarının müfredat bağları yeni / adı değişen konulara göre tazelenir
  for (const s of r.subjects) await relinkPlans(ownerId, s);
  return r;
});
