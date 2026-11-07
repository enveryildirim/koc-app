import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { createRubric } from "@/modules/assessment/server";

/** Yeni puan cetveli (yönetici). Gövde: { name, kind?, criteria: [{ name, max }] } */
export const POST = api(async (req) => {
  const r = await createRubric(await ownerOrThrow(), await req.json());
  return { id: r.id };
});
