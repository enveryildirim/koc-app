import { databaseReachable } from "@/modules/identity/server";

/** Sağlık kontrolü (Dokploy healthcheck): veritabanına basit bir sorgu. Sorun yoksa 200 { ok: true }, yoksa 503. */
export const dynamic = "force-dynamic";

export async function GET() {
  return (await databaseReachable())
    ? Response.json({ ok: true })
    : Response.json({ ok: false, error: "Veritabanına erişilemiyor." }, { status: 503 });
}
