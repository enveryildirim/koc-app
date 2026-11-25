import { api } from "@/shared/http";
import { tooMany } from "@/shared/errors";
import { clientIp, hit } from "@/shared/rateLimit";
import { register } from "@/modules/identity/server";

/** Hesap açma sınırı: saatte adres başına 5. */
export const POST = api(async (req) => {
  const r = hit(`register:${clientIp(req)}`, 5, 60 * 60_000);
  if (!r.ok) throw tooMany(r.retryAfter);
  await register(await req.json());
});
