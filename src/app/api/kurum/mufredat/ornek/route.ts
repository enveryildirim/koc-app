import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { relinkPlans } from "@/modules/planning/server";
import { loadSampleCurriculum } from "@/modules/curriculum/server";

/** Örnek müfredatı yükler (var olan setlere dokunmaz). */
export const POST = api(async () => {
  const ownerId = await ownerOrThrow();
  const r = await loadSampleCurriculum(ownerId);
  for (const s of r.subjects) await relinkPlans(ownerId, s);
  return r;
});
