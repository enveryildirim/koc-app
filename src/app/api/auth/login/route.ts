import { api } from "@/shared/http";
import { tooMany } from "@/shared/errors";
import { clientIp, hit } from "@/shared/rateLimit";
import { login } from "@/modules/identity/server";

const WINDOW = 15 * 60_000;

/** Şifre denemesi sınırı: 15 dakikada adres başına 30, e-posta başına 10 deneme. */
export const POST = api(async (req) => {
  const body = await req.json();
  const email = String(body?.email ?? "").toLowerCase().trim();
  for (const r of [hit(`login:ip:${clientIp(req)}`, 30, WINDOW), hit(`login:email:${email}`, 10, WINDOW)]) {
    if (!r.ok) throw tooMany(r.retryAfter);
  }
  await login(body);
});
