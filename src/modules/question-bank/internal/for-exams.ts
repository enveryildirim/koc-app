import { prisma } from "@/shared/db";
import { parseContent } from "../written";

/** Deneme kurma ekranı için havuzdaki sorular (arşivdekiler hariç; etiketleri ve yazılanların içeriğiyle, yeniden eskiye). */
export async function bankPickerItems(ownerId: string, limit = 5000) {
  const rows = await prisma.questionItem.findMany({
    where: { ownerId, archivedAt: null },
    orderBy: [{ createdAt: "desc" }, { page: "asc" }],
    take: limit,
    select: { id: true, subject: true, topic: true, grade: true, difficulty: true, answer: true, type: true, content: true, imageKey: true },
  });
  return rows.map(({ imageKey, content, ...r }) => ({ ...r, content: parseContent(content), hasImage: !!imageKey }));
}

/**
 * Verilen kimliklerden kurumun olan sorular (tür, cevap, konu ve içerikle). Başka kurumun ya da silinmiş sorular dönmez.
 * Arşivdekiler döner (eski kitapçıklar basılabilsin); yeni sınavda kullanılıp kullanılamayacağına `archived` ile karar verilir.
 */
export async function bankItemsByIds(ownerId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await prisma.questionItem.findMany({
    where: { ownerId, id: { in: ids } },
    select: { id: true, subject: true, topic: true, level: true, answer: true, crop: true, type: true, content: true, imageKey: true, archivedAt: true },
  });
  return rows.map(({ imageKey, content, archivedAt, ...r }) => ({ ...r, content: parseContent(content), hasImage: !!imageKey, archived: !!archivedAt }));
}
