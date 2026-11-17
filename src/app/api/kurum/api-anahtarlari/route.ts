import { api } from "@/shared/http";
import { createApiKey, ownerOrThrow } from "@/modules/identity/server";

/** Yeni API anahtarı: { name } → { id, key } (anahtar yalnızca bu yanıtta görünür). */
export const POST = api(async (req) => {
  const body = await req.json().catch(() => ({}));
  return createApiKey(await ownerOrThrow(), body.name);
});
