/**
 * Kimlikle ilgili yayın ayarları (ortam değişkenleri). Geliştirmede her şey açık; üretimde (NODE_ENV=production)
 * güvenli varsayılanlar: gizli anahtar zorunlu, çerez yalnızca HTTPS, demo girişi ve kayıt kapalı.
 * Değerler istek anında okunur (derleme anında gömülmez).
 */
const isProd = () => process.env.NODE_ENV === "production";
const flag = (name: string) => process.env[name] === "true";

export const AUTH_SECRET_MIN = 32;

/** Üretimde AUTH_SECRET eksik ya da kısaysa hata metni; sorun yoksa null. Sunucu açılışında denetlenir (instrumentation). */
export function authConfigError(): string | null {
  if (!isProd()) return null;
  const s = process.env.AUTH_SECRET ?? "";
  if (!s) return "AUTH_SECRET tanımlı değil. Üretmek için: openssl rand -base64 48";
  if (s.length < AUTH_SECRET_MIN) return `AUTH_SECRET en az ${AUTH_SECRET_MIN} karakter olmalı (şu an ${s.length}).`;
  return null;
}

/** Oturum imzalama anahtarı. Üretimde ayar hatalıysa fırlatır; geliştirmede tanımlı değilse "dev-secret". */
export function authSecret(): Uint8Array {
  const err = authConfigError();
  if (err) throw new Error(err);
  return new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret");
}

/** Oturum çerezi yalnızca HTTPS ile gönderilsin mi. Üretimde evet; yerelde HTTP ile `next start` için COOKIE_SECURE=false. */
export const secureCookies = () => isProd() && process.env.COOKIE_SECURE !== "false";

/** "Demo hesabıyla gir" düğmesi. Üretimde yalnızca SHOW_DEMO_LOGIN=true iken. */
export const showDemoLogin = () => !isProd() || flag("SHOW_DEMO_LOGIN");

/** Yeni kurum hesabı açma (/kayit). Üretimde yalnızca ALLOW_REGISTRATION=true iken. */
export const allowRegistration = () => !isProd() || flag("ALLOW_REGISTRATION");
