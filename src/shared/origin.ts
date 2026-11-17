import "server-only";
import { headers } from "next/headers";

/**
 * Basılı bağlantıların (QR) kökü. Yayında `APP_URL` (yoksa `MCP_APP_URL`) kullanılır; yerelde isteğin adresi
 * (telefondan denemek için uygulamayı `-H 0.0.0.0` ile başlatıp bilgisayarın ağ adresinden açın).
 */
export async function publicOrigin() {
  const env = process.env.APP_URL ?? process.env.MCP_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") || /^\d+\.\d+\.\d+\.\d+/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
