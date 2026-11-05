import { ownerOrThrow } from "@/modules/identity/server";
import { updateWeekly } from "@/modules/reporting/server";
import { api } from "@/shared/http";

/** Haftalık veli raporu: not, gönderildi / geri al, şablon. Gövde biçimi: reporting > updateWeekly. */
export const POST = api(async (req) => {
  const ownerId = await ownerOrThrow();
  return updateWeekly(ownerId, await req.json());
});
