import { APP_TIME_ZONE } from "@/shared/date";

/**
 * Sunucu açılışında bir kez çalışır.
 * - Sunucuyu uygulamanın saat diliminde çalıştırır: sunucu UTC'de (ör. bulut sunucusu) olsa da sayfalardaki saatler ve
 *   "bugün / bu hafta" hesapları İstanbul saatine göre olur. Farklı bir dilim gerekirse APP_TIME_ZONE ile değiştirilir.
 * - Üretimde AUTH_SECRET eksik ya da kısaysa sunucu açılmaz (oturumlar tahmin edilebilir bir anahtarla imzalanmasın).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  process.env.TZ = process.env.APP_TIME_ZONE || APP_TIME_ZONE;
  // server.ts değil: bu dosya edge için de derlenir; config.ts hiçbir şey import etmez (crypto, prisma sızmaz)
  const { authConfigError } = await import("@/modules/identity/internal/config");
  const err = authConfigError();
  if (err) {
    console.error(`[başlangıç] ${err}`);
    process.exit(1);
  }
}
