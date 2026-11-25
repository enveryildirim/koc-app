// Tutarlı SQLite yedeği: `VACUUM INTO` ile <veritabanı klasörü>/backups/app-YYYYMMDD.db yazar,
// KEEP_DAYS (varsayılan 14) günden eski yedekleri siler. Uygulama çalışırken güvenle çalıştırılabilir.
// Kullanım: npm run db:backup   (container içinde: docker exec <container> npm run db:backup)
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("file:")) {
  console.error("DATABASE_URL bir SQLite dosyası olmalı (file:...).");
  process.exit(1);
}
// Prisma göreli yolları şema klasörüne (prisma/) göre çözer
const raw = url.slice("file:".length).split("?")[0];
const dbFile = path.isAbsolute(raw) ? raw : path.resolve("prisma", raw);
const dir = path.join(path.dirname(dbFile), "backups");
const keepDays = Number(process.env.KEEP_DAYS ?? 14);

const d = new Date();
const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
const target = path.join(dir, `app-${stamp}.db`);

await mkdir(dir, { recursive: true });
// VACUUM INTO var olan dosyanın üstüne yazmaz: aynı gün ikinci yedekte eskisi silinir
await rm(target, { force: true });

const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
} finally {
  await prisma.$disconnect();
}
console.log(`Yedek yazıldı: ${target} (${((await stat(target)).size / 1024 / 1024).toFixed(1)} MB)`);

const cutoff = Date.now() - keepDays * 86_400_000;
for (const f of await readdir(dir)) {
  if (!/^app-\d{8}\.db$/.test(f)) continue;
  const p = path.join(dir, f);
  if ((await stat(p)).mtimeMs < cutoff) {
    await rm(p);
    console.log(`Eski yedek silindi: ${f}`);
  }
}
