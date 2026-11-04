import { api, type Params } from "@/shared/http";
import { submitPublicAttempt } from "@/modules/online-test/server";

/** Katılımcının sınavı göndermesi (giriş gerektirmez). */
export const POST = api<Params<{ code: string }>>(async (req, ctx) => {
  return submitPublicAttempt((await ctx.params).code, await req.json());
});
