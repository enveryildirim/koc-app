import { ownerOrThrow } from "@/modules/identity/server";
import { saveScoreSettings } from "@/modules/reporting/server";
import { api } from "@/shared/http";

/** Başarı Skoru ayarlarını kaydeder. body: { settings } ya da { settings: null } (varsayılana dön). */
export const POST = api(async (req) => {
  const ownerId = await ownerOrThrow();
  const { settings } = await req.json();
  return { settings: await saveScoreSettings(ownerId, settings ?? null) };
});
