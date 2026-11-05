import type { Prisma } from "@prisma/client";
import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { getFile, putFile, removeFiles, sniff } from "@/shared/storage";
import { normalizeLevel } from "@/shared/cognitive";
import { ANSWERS, LIMITS, type Crop, type QuestionMeta, type QuestionPatch } from "../index";

const ORIGINS = new Set(["MANUAL", "AUTO", "AI"]);
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function cleanCrop(c: unknown): Crop | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const n = ["x", "y", "w", "h"].map((k) => Number(o[k]));
  if (n.some((v) => !isFinite(v) || v < 0 || v > 1)) return null;
  return { x: n[0], y: n[1], w: n[2], h: n[3] };
}

function cleanAnswer(v: unknown) {
  const a = str(v, 1).toUpperCase();
  return (ANSWERS as readonly string[]).includes(a) ? a : "";
}

function cleanDifficulty(v: unknown) {
  const d = Math.round(Number(v));
  return d >= 1 && d <= 3 ? d : 2;
}

/** Düzenlenebilir alanları doğrular; yalnızca gönderilen alanları döndürür. */
function cleanPatch(p: Record<string, unknown>): QuestionPatch {
  const out: QuestionPatch = {};
  if ("subject" in p) {
    out.subject = str(p.subject, 60);
    if (!out.subject) throw invalid("Ders boş olamaz.");
  }
  if ("topic" in p) out.topic = str(p.topic, 120);
  if ("grade" in p) out.grade = str(p.grade, 20);
  if ("difficulty" in p) out.difficulty = cleanDifficulty(p.difficulty);
  if ("level" in p) out.level = normalizeLevel(p.level);
  if ("answer" in p) out.answer = cleanAnswer(p.answer);
  return out;
}

/**
 * Kesme ekranından gelen soruları kaydeder: her etiket kaydı için bir PNG/JPG/WEBP görsel.
 * sourceId verilirse kurumun kaynağı olmalıdır.
 */
export async function createItems(ownerId: string, sourceId: string | null, metas: unknown, images: Uint8Array[]) {
  if (!Array.isArray(metas) || metas.length !== images.length) throw invalid("Soru bilgileri ile görseller eşleşmiyor.");
  if (!metas.length) throw invalid("Kaydedilecek soru yok.");
  if (metas.length > LIMITS.batch) throw invalid(`Tek seferde en fazla ${LIMITS.batch} soru kaydedilebilir.`);
  if (sourceId && !(await prisma.questionSource.findFirst({ where: { id: sourceId, ownerId }, select: { id: true } })))
    throw notFound("Kaynak bulunamadı.");

  const kinds = images.map((b) => sniff(b));
  if (kinds.some((k) => !k || k === "pdf")) throw invalid("Soru görseli PNG, JPG ya da WEBP olmalı.");
  if (images.some((b) => b.length > LIMITS.cropMB * 1024 * 1024)) throw invalid(`Soru görseli en fazla ${LIMITS.cropMB} MB olabilir.`);

  const rows = (metas as QuestionMeta[]).map((m) => {
    const subject = str(m?.subject, 60);
    if (!subject) throw invalid("Her soru için ders seçin.");
    const crop = cleanCrop(m.crop);
    const page = Number.isInteger(m.page) && m.page! > 0 ? m.page! : null;
    return {
      subject,
      topic: str(m.topic, 120),
      grade: str(m.grade, 20),
      difficulty: cleanDifficulty(m.difficulty),
      level: normalizeLevel(m.level),
      answer: cleanAnswer(m.answer),
      origin: ORIGINS.has(String(m.origin)) ? String(m.origin) : "MANUAL",
      page: sourceId ? page : null,
      crop: sourceId && crop ? JSON.stringify(crop) : "",
    };
  });

  const keys: string[] = [];
  try {
    for (let i = 0; i < images.length; i++) keys.push(await putFile(ownerId, kinds[i] as "png", images[i]));
    await prisma.questionItem.createMany({
      data: rows.map((r, i) => ({ ...r, ownerId, sourceId, imageKey: keys[i] })),
    });
  } catch (e) {
    await removeFiles(ownerId, keys);
    throw e;
  }
  return { created: rows.length };
}

export type ItemFilter = {
  subject?: string;
  topic?: string;
  difficulty?: string;
  sourceId?: string;
  /** "cevap" = cevabı girilmemiş, "konu" = konusu girilmemiş */
  missing?: string;
  q?: string;
};

const PAGE_SIZE = 120;

/** Havuz listesi (yeniden eskiye, sayfalı) ve filtreye uyan toplam soru sayısı. */
export async function listItems(ownerId: string, f: ItemFilter = {}, page = 1) {
  const where: Prisma.QuestionItemWhereInput = { ownerId };
  if (f.subject) where.subject = f.subject;
  if (f.topic) where.topic = f.topic;
  if (f.difficulty) where.difficulty = cleanDifficulty(f.difficulty);
  if (f.sourceId) where.sourceId = f.sourceId;
  if (f.missing === "cevap") where.answer = "";
  if (f.missing === "konu") where.topic = "";
  if (f.q) where.OR = [{ topic: { contains: f.q } }, { text: { contains: f.q } }];

  const [total, items] = await Promise.all([
    prisma.questionItem.count({ where }),
    prisma.questionItem.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { page: "asc" }],
      skip: (Math.max(1, page) - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, subject: true, topic: true, grade: true, difficulty: true, level: true, answer: true, origin: true, usedCount: true, page: true, source: { select: { name: true } } },
    }),
  ]);
  return { total, items, pageSize: PAGE_SIZE };
}

/** Özet sayıları ve filtre seçenekleri: dersler, ders → konular. */
export async function bankSummary(ownerId: string) {
  const [total, noAnswer, groups] = await Promise.all([
    prisma.questionItem.count({ where: { ownerId } }),
    prisma.questionItem.count({ where: { ownerId, answer: "" } }),
    prisma.questionItem.groupBy({ by: ["subject", "topic"], where: { ownerId }, _count: { _all: true } }),
  ]);
  const topics: Record<string, string[]> = {};
  for (const g of groups) {
    (topics[g.subject] ??= []);
    if (g.topic) topics[g.subject].push(g.topic);
  }
  for (const s of Object.keys(topics)) topics[s].sort((a, b) => a.localeCompare(b, "tr"));
  const subjects = Object.keys(topics).sort((a, b) => a.localeCompare(b, "tr"));
  return { total, noAnswer, subjects, topics };
}

/** Seçili soruların alanlarını toplu günceller; başka kurumun soruları atlanır. */
export async function updateItems(ownerId: string, ids: unknown, patch: unknown) {
  if (!Array.isArray(ids) || !ids.length) throw invalid("Soru seçin.");
  const data = cleanPatch((patch ?? {}) as Record<string, unknown>);
  if (!Object.keys(data).length) throw invalid("Değiştirilecek alan yok.");
  const r = await prisma.questionItem.updateMany({ where: { ownerId, id: { in: ids.map(String) } }, data });
  return { updated: r.count };
}

/** Seçili soruları ve görsellerini siler. */
export async function deleteItems(ownerId: string, ids: unknown) {
  if (!Array.isArray(ids) || !ids.length) throw invalid("Soru seçin.");
  const where = { ownerId, id: { in: ids.map(String) } };
  const rows = await prisma.questionItem.findMany({ where, select: { imageKey: true } });
  await prisma.questionItem.deleteMany({ where });
  await removeFiles(ownerId, rows.map((r) => r.imageKey));
  return { deleted: rows.length };
}

/** Sorunun görseli. */
export async function itemImage(ownerId: string, id: string) {
  const it = await prisma.questionItem.findFirst({ where: { id, ownerId }, select: { imageKey: true } });
  const f = it ? await getFile(ownerId, it.imageKey) : null;
  if (!f) throw notFound("Görsel bulunamadı.");
  return f;
}
