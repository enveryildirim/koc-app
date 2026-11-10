import { prisma } from "@/shared/db";
import { parseContent } from "../written";

/** Deneme kurma ekranı için havuzdaki tüm sorular (etiketleri ve yazılanların içeriğiyle, yeniden eskiye). */
export async function bankPickerItems(ownerId: string, limit = 5000) {
  const rows = await prisma.questionItem.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: "desc" }, { page: "asc" }],
    take: limit,
    select: { id: true, subject: true, topic: true, grade: true, difficulty: true, answer: true, usedCount: true, type: true, content: true, imageKey: true },
  });
  return rows.map(({ imageKey, content, ...r }) => ({ ...r, content: parseContent(content), hasImage: !!imageKey }));
}

/** Verilen kimliklerden kurumun olan sorular (tür, cevap, konu ve içerikle). Başka kurumun ya da silinmiş sorular dönmez. */
export async function bankItemsByIds(ownerId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await prisma.questionItem.findMany({
    where: { ownerId, id: { in: ids } },
    select: { id: true, subject: true, topic: true, level: true, answer: true, crop: true, type: true, content: true, imageKey: true },
  });
  return rows.map(({ imageKey, content, ...r }) => ({ ...r, content: parseContent(content), hasImage: !!imageKey }));
}

/** Denemede kullanılan soruların kullanım sayısını artırır (tekrar kullanım uyarısı için). */
export async function markBankItemsUsed(ownerId: string, ids: string[]) {
  if (!ids.length) return;
  await prisma.questionItem.updateMany({ where: { ownerId, id: { in: ids } }, data: { usedCount: { increment: 1 } } });
}
