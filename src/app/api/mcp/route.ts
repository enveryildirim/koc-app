import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ownerFromApiKey } from "@/modules/identity/server";
import { createBankServer } from "@/mcp/bank-server";
import { clientIp, hit } from "@/shared/rateLimit";

/**
 * Uzaktan MCP (Streamable HTTP, durumsuz): soru havuzu araçları (src/mcp/bank-server.ts).
 * Kimlik: `Authorization: Bearer rqb_…` (Soru havuzu → Yapay zekâ bağlantısı sayfasında oluşturulan kurum anahtarı).
 * Her istek için yeni sunucu + transport (oturum tutulmaz). Görsel yalnızca base64 kabul edilir.
 */
export const dynamic = "force-dynamic";

const unauthorized = () =>
  Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message: "Geçersiz ya da eksik API anahtarı (Authorization: Bearer rqb_…)." }, id: null },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="rea-question-bank"' } },
  );

const tooMany = (retryAfter: number) =>
  Response.json(
    { jsonrpc: "2.0", error: { code: -32029, message: `Çok fazla istek. ${retryAfter} saniye sonra tekrar deneyin.` }, id: null },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );

/** İstek sınırı: adres başına dakikada 300 istek; geçersiz anahtarla 10 dakikada 20 deneme (anahtar tahminine karşı). */
async function handle(req: Request) {
  const ip = clientIp(req);
  const rate = hit(`mcp:${ip}`, 300, 60_000);
  if (!rate.ok) return tooMany(rate.retryAfter);
  const auth = req.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1];
  const owner = await ownerFromApiKey(token);
  if (!owner) {
    const bad = hit(`mcp:bad:${ip}`, 20, 10 * 60_000);
    return bad.ok ? unauthorized() : tooMany(bad.retryAfter);
  }
  const server = await createBankServer({
    // Anahtar her istekte yeniden çözülür; istek içinde kurum değişmez
    ownerId: async () => owner.id,
    appUrl: process.env.MCP_APP_URL ?? new URL(req.url).origin,
    localFiles: false,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // Yanıt JSON olarak hazır (enableJsonResponse); sunucu istekten sonra kapanır
    void server.close();
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
