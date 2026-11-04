import { api } from "@/shared/http";
import { register } from "@/modules/identity/server";

export const POST = api(async (req) => {
  await register(await req.json());
});
