import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { createEvent } from "@/modules/planning/server";

export const POST = api(async (req) => {
  const e = await createEvent(await ownerOrThrow(), await req.json());
  return { id: e.id };
});
