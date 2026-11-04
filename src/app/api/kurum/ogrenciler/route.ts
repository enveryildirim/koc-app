import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { createStudent } from "@/modules/enrollment/server";

export const POST = api(async (req) => {
  const st = await createStudent(await ownerOrThrow(), await req.json());
  return { id: st.id };
});
