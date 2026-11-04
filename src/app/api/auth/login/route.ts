import { api } from "@/shared/http";
import { login } from "@/modules/identity/server";

export const POST = api(async (req) => {
  await login(await req.json());
});
