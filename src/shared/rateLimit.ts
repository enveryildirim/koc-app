/**
 * Bellek içi sabit pencereli istek sınırı. Uygulama tek kopya çalıştığı için (DEPLOY.md) süreç belleği yeterli;
 * yeniden başlatmada sayaçlar sıfırlanır. Birden fazla kopyaya geçilirse ortak bir depoya (ör. Redis) taşınmalı.
 */
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

/** `key` için pencere içindeki istek sayısını artırır. Sınır aşıldıysa ok=false ve kaç saniye sonra açılacağı. */
export function hit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfter: number } {
  if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  let b = buckets.get(key);
  if (!b || b.reset <= now) buckets.set(key, (b = { count: 0, reset: now + windowMs }));
  b.count++;
  return { ok: b.count <= limit, retryAfter: Math.ceil((b.reset - now) / 1000) };
}

/**
 * İsteğin geldiği adres. Dokploy'da Traefik, dışarıdan gelen X-Forwarded-For'u atıp kendisi yazar (güvenilmeyen
 * kaynaktan gelen başlıkları kabul etmez); ilk adres istemcidir. Doğrudan erişimde başlık yoksa "local".
 */
export function clientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
