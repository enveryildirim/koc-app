/**
 * Local MCP server for the question bank (stdio). Tools and prompts: ./bank-server.ts. Remote (HTTP) variant: /api/mcp.
 *
 * Run: `npm run mcp` (see .mcp.json). Env: MCP_OWNER_EMAIL (needed only when the database has more than one account),
 * MCP_APP_URL (for review links, default http://localhost:3000). Works only on the machine that holds the database.
 * stdout belongs to the MCP protocol; log only to stderr.
 */
import path from "path";
import { existsSync } from "fs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createBankServer } from "./bank-server";

const ROOT = path.resolve(__dirname, "../..");

async function main() {
  // Storage paths and SQLite URL are relative to the repo root; the agent may start us from anywhere.
  process.chdir(ROOT);
  if (existsSync(".env")) process.loadEnvFile(".env");

  // Imported after chdir / env so modules resolve paths and DATABASE_URL correctly.
  const { resolveLocalOwner } = await import("@/modules/identity/server");
  // Checked once at start (fail fast), then again on every call: re-seeding the database gives the account a new id.
  const owner = await resolveLocalOwner(process.env.MCP_OWNER_EMAIL);
  const server = await createBankServer({
    ownerId: async () => (await resolveLocalOwner(process.env.MCP_OWNER_EMAIL)).id,
    appUrl: process.env.MCP_APP_URL ?? "http://localhost:3000",
    localFiles: true,
  });
  await server.connect(new StdioServerTransport());
  console.error(`rea-question-bank MCP ready for ${owner.name}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
