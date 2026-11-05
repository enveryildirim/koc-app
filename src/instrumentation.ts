import { APP_TIME_ZONE } from "@/shared/date";

/**
 * Sunucu açılışında bir kez çalışır. Sunucuyu uygulamanın saat diliminde çalıştırır: sunucu UTC'de
 * (ör. bulut sunucusu) olsa da sayfalardaki saatler ve "bugün / bu hafta" hesapları İstanbul saatine göre olur.
 * Farklı bir dilim gerekirse APP_TIME_ZONE ortam değişkeniyle değiştirilebilir.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") process.env.TZ = process.env.APP_TIME_ZONE || APP_TIME_ZONE;
}
