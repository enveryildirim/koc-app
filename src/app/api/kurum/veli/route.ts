import { ownerOrThrow } from "@/modules/identity/server";
import { manageParentLinks } from "@/modules/reporting/server";
import { api } from "@/shared/http";

/**
 * Veli karnesi linklerini yönetir.
 * body: { action: "share" | "renew" | "revoke", studentIds: string[] }
 */
export const POST = api(async (req) => {
  const ownerId = await ownerOrThrow();
  return { students: await manageParentLinks(ownerId, await req.json()) };
});
