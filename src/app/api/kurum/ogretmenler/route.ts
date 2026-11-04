import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { createTeacher } from "@/modules/schedule/server";

export const POST = api(async (req) => {
  const t = await createTeacher(await ownerOrThrow(), await req.json());
  return { id: t.id };
});
