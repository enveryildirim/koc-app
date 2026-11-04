import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { createPlan } from "@/modules/planning/server";

export const POST = api(async (req) => {
  const p = await createPlan(await ownerOrThrow(), await req.json());
  return { id: p.id };
});
