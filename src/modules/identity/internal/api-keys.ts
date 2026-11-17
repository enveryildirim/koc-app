import { createHash, randomBytes } from "crypto";
import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";

/**
 * Kurum API anahtarları: uzaktan MCP bağlantısı (/api/mcp) için. Anahtar "rqb_" + 32 rastgele bayt (base64url);
 * yalnızca SHA-256 özeti saklanır, düz metin bir kez (oluşturulurken) döner.
 */
const PREFIX = "rqb_";
const hashOf = (key: string) => createHash("sha256").update(key).digest("hex");

export async function createApiKey(ownerId: string, name: unknown) {
  const n = String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!n) throw invalid("Anahtara bir ad verin (ör. kimin, hangi araçta kullanacağı).");
  const active = await prisma.apiKey.count({ where: { ownerId, revokedAt: null } });
  if (active >= 20) throw invalid("En fazla 20 etkin anahtar olabilir; kullanılmayanları iptal edin.");
  const key = PREFIX + randomBytes(32).toString("base64url");
  const row = await prisma.apiKey.create({ data: { ownerId, name: n, hash: hashOf(key), prefix: key.slice(0, 8) }, select: { id: true } });
  return { id: row.id, key };
}

/** Kurumun anahtarları (iptal edilenler dahil, yeniden eskiye). */
export async function listApiKeys(ownerId: string) {
  return prisma.apiKey.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true },
  });
}

export async function revokeApiKey(ownerId: string, id: string) {
  const r = await prisma.apiKey.updateMany({ where: { id, ownerId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!r.count) throw notFound("Anahtar bulunamadı ya da zaten iptal edilmiş.");
  return { ok: true };
}

/**
 * Anahtardan kurum: geçerli ve iptal edilmemişse { id, name }, değilse null. Son kullanım zamanı en fazla dakikada bir yazılır.
 */
export async function ownerFromApiKey(key: string | null | undefined) {
  const k = String(key ?? "").trim();
  if (!k.startsWith(PREFIX) || k.length < 20) return null;
  const row = await prisma.apiKey.findUnique({ where: { hash: hashOf(k) }, select: { id: true, ownerId: true, revokedAt: true, lastUsedAt: true } });
  if (!row || row.revokedAt) return null;
  const user = await prisma.user.findUnique({ where: { id: row.ownerId }, select: { id: true, name: true } });
  if (!user) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) await prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return user;
}
