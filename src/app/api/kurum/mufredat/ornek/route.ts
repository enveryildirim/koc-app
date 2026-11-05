import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { loadSampleCurriculum } from "@/modules/curriculum/server";

/** Örnek müfredatı yükler (var olan setlere dokunmaz). */
export const POST = api(async () => loadSampleCurriculum(await ownerOrThrow()));
