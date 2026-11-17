import { prisma } from "@/shared/db";
import { parseContent } from "../written";

/** Deneme kurma ekranı için havuzdaki sorular (arşivdekiler ve onay bekleyenler hariç; etiketleri ve yazılanların içeriğiyle, yeniden eskiye). */
export async function bankPickerItems(ownerId: string, limit = 5000) {
  const rows = await prisma.questionItem.findMany({
    where: { ownerId, archivedAt: null, needsReview: false },
    orderBy: [{ createdAt: "desc" }, { page: "asc" }],
    take: limit,
    select: { id: true, subject: true, topic: true, grade: true, difficulty: true, answer: true, type: true, content: true, imageKey: true },
  });
  return rows.map(({ imageKey, content, ...r }) => ({ ...r, content: parseContent(content), hasImage: !!imageKey }));
}

/**
 * Verilen kimliklerden kurumun olan sorular (tür, cevap, konu ve içerikle). Başka kurumun ya da silinmiş sorular dönmez.
 * Arşivdekiler döner (eski kitapçıklar basılabilsin); yeni sınavda kullanılıp kullanılamayacağına `archived` ile karar verilir.
 * Onay bekleyen soru (yapay zekâ ile eklenmiş, öğretmen onaylamamış) yeni sınavda kullanılamaz: `pending`.
 */
export async function bankItemsByIds(ownerId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await prisma.questionItem.findMany({
    where: { ownerId, id: { in: ids } },
    select: { id: true, subject: true, topic: true, level: true, answer: true, explanation: true, crop: true, type: true, content: true, imageKey: true, archivedAt: true, needsReview: true },
  });
  return rows.map(({ imageKey, content, archivedAt, needsReview, ...r }) => ({ ...r, content: parseContent(content), hasImage: !!imageKey, archived: !!archivedAt, pending: needsReview }));
}
