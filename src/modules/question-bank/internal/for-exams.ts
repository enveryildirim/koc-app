import { prisma } from "@/shared/db";

/** Deneme kurma ekranı için havuzdaki tüm sorular (etiketleriyle, yeniden eskiye). */
export async function bankPickerItems(ownerId: string, limit = 5000) {
  return prisma.questionItem.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: "desc" }, { page: "asc" }],
    take: limit,
    select: { id: true, subject: true, topic: true, grade: true, difficulty: true, answer: true, usedCount: true },
  });
}

/** Verilen kimliklerden kurumun olan sorular (cevap ve konuyla). Başka kurumun ya da silinmiş sorular dönmez. */
export async function bankItemsByIds(ownerId: string, ids: string[]) {
  if (!ids.length) return [];
  return prisma.questionItem.findMany({
    where: { ownerId, id: { in: ids } },
    select: { id: true, subject: true, topic: true, answer: true, crop: true },
  });
}

/** Denemede kullanılan soruların kullanım sayısını artırır (tekrar kullanım uyarısı için). */
export async function markBankItemsUsed(ownerId: string, ids: string[]) {
  if (!ids.length) return;
  await prisma.questionItem.updateMany({ where: { ownerId, id: { in: ids } }, data: { usedCount: { increment: 1 } } });
}
