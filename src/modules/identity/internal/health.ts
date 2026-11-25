import { prisma } from "@/shared/db";

/** Sağlık kontrolü için: veritabanına basit bir sorgu atılabiliyor mu. Hata günlüğe yazılır, dışarıya ayrıntı verilmez. */
export async function databaseReachable() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (e) {
    console.error("[health]", e);
    return false;
  }
}
