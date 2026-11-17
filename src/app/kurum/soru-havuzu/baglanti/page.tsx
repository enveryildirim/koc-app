import { headers } from "next/headers";
import { listApiKeys, requireOwner } from "@/modules/identity/server";
import ApiKeys from "@/modules/identity/ui/ApiKeys";
import { PageHeader } from "@/shared/ui/kurum";

export const dynamic = "force-dynamic";

/** Yapay zekâ agent'larının uzaktan bağlantısı (MCP): kurum API anahtarları ve bağlanma komutları. */
export default async function Page() {
  const ownerId = await requireOwner();
  const keys = await listApiKeys(ownerId);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const endpoint = `${(process.env.MCP_APP_URL ?? `${proto}://${host}`).replace(/\/$/, "")}/api/mcp`;
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Yapay zekâ bağlantısı"
        sub="Claude Code, Claude Desktop, Cursor gibi bir agent'ı soru havuzuna bağlayın. Agent'ın eklediği sorular onayınızı bekler."
        back={{ href: "/kurum/soru-havuzu", label: "Soru havuzu" }}
      />
      <ApiKeys
        endpoint={endpoint}
        keys={keys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null }))}
      />
    </div>
  );
}
