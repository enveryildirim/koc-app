import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ownerFromApiKey } from "@/modules/identity/server";
import { createBankServer } from "@/mcp/bank-server";

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

async function handle(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1];
  const owner = await ownerFromApiKey(token);
  if (!owner) return unauthorized();
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
