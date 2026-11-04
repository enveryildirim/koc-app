import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { createClassroom } from "@/modules/enrollment/server";

export const POST = api(async (req) => {
  const c = await createClassroom(await ownerOrThrow(), await req.json());
  return { id: c.id };
});
