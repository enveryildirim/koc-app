import type { Prisma } from "@prisma/client";
import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { getFile, putFile, removeFiles, sniff } from "@/shared/storage";
import { normalizeLevel } from "@/shared/cognitive";
import {
  ANSWERS,
  countBlanks,
  isQuestionType,
  LIMITS,
  MAX_OPTIONS,
  normalizeAnswer,
  parseContent,
  plainText,
  QUESTION_TYPES,
  splitFill,
  TEXT_LIMITS,
  type Crop,
  type QuestionContent,
  type QuestionMeta,
  type QuestionPatch,
  type QuestionType,
  type WrittenMeta,
} from "../index";

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

/** Ders / konu / düzey / zorluk / bilişsel düzey: kesme ve yazma ekranında ortak. */
function cleanTags(m: { subject?: unknown; topic?: unknown; grade?: unknown; difficulty?: unknown; level?: unknown }) {
  const subject = str(m?.subject, 60);
  if (!subject) throw invalid("Her soru için ders seçin.");
  return { subject, topic: str(m.topic, 120), grade: str(m.grade, 20), difficulty: cleanDifficulty(m.difficulty), level: normalizeLevel(m.level) };
}

/** Düzenlenebilir alanları doğrular; yalnızca gönderilen alanları döndürür (cevap türe göre ayrıca denetlenir). */
function cleanPatch(p: Record<string, unknown>): Omit<QuestionPatch, "answer"> {
  const out: Omit<QuestionPatch, "answer"> = {};
  if ("subject" in p) {
    out.subject = str(p.subject, 60);
    if (!out.subject) throw invalid("Ders boş olamaz.");
  }
  if ("topic" in p) out.topic = str(p.topic, 120);
  if ("grade" in p) out.grade = str(p.grade, 20);
  if ("difficulty" in p) out.difficulty = cleanDifficulty(p.difficulty);
  if ("level" in p) out.level = normalizeLevel(p.level);
  return out;
}

/**
 * Yazılan sorunun içeriğini ve cevabını doğrular. `label` hata iletisinin başına eklenir ("3. soru: …").
 * Görsel varsa kök boş olabilir (ör. ekran görüntüsü + yazılmış şıklar).
 */
function cleanWritten(m: WrittenMeta, hasImage: boolean, label = "") {
  const fail = (msg: string) => invalid(label ? `${label}: ${msg}` : msg);
  if (!isQuestionType(m?.type)) throw fail("Soru türü geçersiz.");
  const type = m.type as QuestionType;
  const stem = String(m.stem ?? "").replace(/\r\n?/g, "\n").replace(/\s+$/, "").replace(/^\n+/, "");
  if (stem.length > TEXT_LIMITS.stem) throw fail(`Soru metni en fazla ${TEXT_LIMITS.stem} karakter olabilir.`);
  if (!stem.trim() && !hasImage) throw fail("Soru metnini yazın ya da bir görsel ekleyin.");
  const content: QuestionContent = { stem };
  if (type === "MC") {
    const options = (Array.isArray(m.options) ? m.options : []).map((o) => str(o, TEXT_LIMITS.option));
    while (options.length > 2 && !options[options.length - 1]) options.pop();
    if (options.length < 2) throw fail("En az iki şık yazın.");
    if (options.length > MAX_OPTIONS) throw fail(`En fazla ${MAX_OPTIONS} şık olabilir.`);
    if (options.some((o) => !o)) throw fail("Boş şık bırakmayın.");
    content.options = options;
  }
  if (type === "FILL" && !countBlanks(stem)) throw fail("Boşluk doldurma sorusunda en az bir boşluk (___) olmalı.");
  const answer = normalizeAnswer(type, m.answer, content.options?.length);
  if (type === "FILL" && answer && splitFill(answer).length !== countBlanks(stem)) throw fail("Her boşluk için bir cevap girin.");
  return { type, content, answer, text: plainText(content) };
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

  checkImages(images);
  const rows = (metas as QuestionMeta[]).map((m) => {
    const crop = cleanCrop(m.crop);
    const page = Number.isInteger(m.page) && m.page! > 0 ? m.page! : null;
    return {
      ...cleanTags(m),
      answer: cleanAnswer(m.answer),
      origin: ORIGINS.has(String(m.origin)) ? String(m.origin) : "MANUAL",
      page: sourceId ? page : null,
      crop: sourceId && crop ? JSON.stringify(crop) : "",
    };
  });

  const keys = await storeImages(ownerId, images);
  try {
    await prisma.questionItem.createMany({ data: rows.map((r, i) => ({ ...r, ownerId, sourceId, imageKey: keys[i] })) });
  } catch (e) {
    await removeFiles(ownerId, keys);
    throw e;
  }
  return { created: rows.length };
}

function checkImages(images: (Uint8Array | null)[]) {
  for (const b of images) {
    if (!b) continue;
    const k = sniff(b);
    if (!k || k === "pdf") throw invalid("Soru görseli PNG, JPG ya da WEBP olmalı.");
    if (b.length > LIMITS.cropMB * 1024 * 1024) throw invalid(`Soru görseli en fazla ${LIMITS.cropMB} MB olabilir.`);
  }
}

/** Görselleri depoya yazar; null olanlar için "" döner. Hata olursa yazılanları geri siler. */
async function storeImages(ownerId: string, images: (Uint8Array | null)[]) {
  const keys: string[] = [];
  try {
    for (const b of images) keys.push(b ? await putFile(ownerId, sniff(b) as "png", b) : "");
  } catch (e) {
    await removeFiles(ownerId, keys);
    throw e;
  }
  return keys;
}

/**
 * Elle yazılan ya da yapıştırılıp bölünen soruları kaydeder. images[i]: i. sorunun isteğe bağlı görseli (yoksa null).
 * Hatalı bir soru varsa hiçbiri kaydedilmez; ileti sorunun sırasını söyler.
 */
export async function createWrittenItems(ownerId: string, metas: unknown, images: (Uint8Array | null)[]) {
  if (!Array.isArray(metas) || !metas.length) throw invalid("Kaydedilecek soru yok.");
  if (metas.length > LIMITS.batch) throw invalid(`Tek seferde en fazla ${LIMITS.batch} soru kaydedilebilir.`);
  checkImages(images);
  const many = metas.length > 1;
  const rows = (metas as WrittenMeta[]).map((m, i) => {
    const label = many ? `${i + 1}. soru` : "";
    try {
      const w = cleanWritten(m, !!images[i], label);
      return { ...cleanTags(m), type: w.type, content: JSON.stringify(w.content), text: w.text, answer: w.answer, origin: "MANUAL" };
    } catch (e) {
      if (label && e instanceof Error && !e.message.startsWith(label)) throw invalid(`${label}: ${e.message}`);
      throw e;
    }
  });
  const keys = await storeImages(ownerId, rows.map((_, i) => images[i] ?? null));
  try {
    await prisma.questionItem.createMany({ data: rows.map((r, i) => ({ ...r, ownerId, sourceId: null, imageKey: keys[i] })) });
  } catch (e) {
    await removeFiles(ownerId, keys);
    throw e;
  }
  return { created: rows.length };
}

/**
 * Yazılan soruyu günceller. image: yeni görsel; "remove" görseli kaldırır; undefined görsele dokunmaz.
 * Kesilmiş soruların içeriği görseldedir; onlar yalnızca etiket ve cevapla (updateItems) düzenlenir.
 */
export async function updateWrittenItem(ownerId: string, id: string, meta: unknown, image?: Uint8Array | "remove") {
  const it = await prisma.questionItem.findFirst({ where: { id, ownerId }, select: { id: true, content: true, imageKey: true } });
  if (!it) throw notFound("Soru bulunamadı.");
  if (!it.content) throw invalid("Kesilmiş sorunun içeriği görseldedir; yalnızca etiketleri düzenlenebilir.");
  const img = image instanceof Uint8Array ? image : null;
  if (img) checkImages([img]);
  const hasImage = img ? true : image === "remove" ? false : !!it.imageKey;
  const m = meta as WrittenMeta;
  const w = cleanWritten(m, hasImage);
  const [key] = img ? await storeImages(ownerId, [img]) : [image === "remove" ? "" : it.imageKey];
  try {
    await prisma.questionItem.update({
      where: { id: it.id },
      data: { ...cleanTags(m), type: w.type, content: JSON.stringify(w.content), text: w.text, answer: w.answer, imageKey: key },
    });
  } catch (e) {
    if (img) await removeFiles(ownerId, [key]);
    throw e;
  }
  if (it.imageKey && key !== it.imageKey) await removeFiles(ownerId, [it.imageKey]);
  return { id: it.id };
}

/** Düzenleme ekranı için yazılan soru; kesilmiş ya da başka kurumun sorusunda null. */
export async function findWrittenItem(ownerId: string, id: string) {
  const it = await prisma.questionItem.findFirst({
    where: { id, ownerId },
    select: { id: true, type: true, content: true, answer: true, subject: true, topic: true, grade: true, difficulty: true, level: true, imageKey: true },
  });
  const content = parseContent(it?.content);
  if (!it || !content) return null;
  const { imageKey, content: _raw, ...rest } = it;
  void _raw;
  return { ...rest, stem: content.stem, options: content.options ?? [], hasImage: !!imageKey };
}

export type ItemFilter = {
  subject?: string;
  topic?: string;
  difficulty?: string;
  sourceId?: string;
  /** MC | TF | OPEN | FILL */
  type?: string;
  /** "cevap" = cevabı girilmemiş, "konu" = konusu girilmemiş */
  missing?: string;
  q?: string;
  /** Yalnızca bu sorular / bu sorular hariç (kullanım süzgeçleri; kullanım exams'ten hesaplanıp verilir) */
  only?: string[];
  except?: string[];
  /** Verilirse bu sıra önce gelir (ör. en çok kullanılan); kalanlar yeniden eskiye */
  rank?: string[];
};

const PAGE_SIZE = 120;
/** Cevabı eksik sayılan sorular: açık uçluda örnek cevap isteğe bağlıdır. */
const NO_ANSWER: Prisma.QuestionItemWhereInput = { answer: "", type: { not: "OPEN" } };

/** Havuz listesi (yeniden eskiye, sayfalı) ve filtreye uyan toplam soru sayısı. */
export async function listItems(ownerId: string, f: ItemFilter = {}, page = 1) {
  const where: Prisma.QuestionItemWhereInput = { ownerId };
  if (f.subject) where.subject = f.subject;
  if (f.topic) where.topic = f.topic;
  if (f.difficulty) where.difficulty = cleanDifficulty(f.difficulty);
  if (f.sourceId) where.sourceId = f.sourceId;
  if (f.type && isQuestionType(f.type)) where.type = f.type;
  if (f.missing === "cevap") Object.assign(where, NO_ANSWER, f.type && isQuestionType(f.type) && f.type !== "OPEN" ? { type: f.type } : {});
  if (f.missing === "konu") where.topic = "";
  if (f.q) where.OR = [{ topic: { contains: f.q } }, { text: { contains: f.q } }];
  if (f.only || f.except) where.id = { ...(f.only ? { in: f.only } : {}), ...(f.except ? { notIn: f.except } : {}) };

  const select = {
    id: true, subject: true, topic: true, grade: true, difficulty: true, level: true, answer: true, origin: true, page: true,
    type: true, content: true, imageKey: true, source: { select: { name: true } },
  } satisfies Prisma.QuestionItemSelect;
  const orderBy: Prisma.QuestionItemOrderByWithRelationInput[] = [{ createdAt: "desc" }, { page: "asc" }];
  const skip = (Math.max(1, page) - 1) * PAGE_SIZE;
  let total: number;
  let rows: Prisma.QuestionItemGetPayload<{ select: typeof select }>[];
  if (f.rank?.length) {
    // Sıra veritabanında değil (kullanım hesaplanır): eşleşen kimlikler sıralanıp sayfa kesilir
    const pos = new Map(f.rank.map((id, i) => [id, i]));
    const ids = (await prisma.questionItem.findMany({ where, orderBy, select: { id: true } })).map((r) => r.id);
    ids.sort((a, b) => (pos.get(a) ?? Infinity) - (pos.get(b) ?? Infinity));
    total = ids.length;
    const slice = ids.slice(skip, skip + PAGE_SIZE);
    const got = new Map((await prisma.questionItem.findMany({ where: { id: { in: slice } }, select })).map((r) => [r.id, r]));
    rows = slice.map((id) => got.get(id)!).filter(Boolean);
  } else {
    [total, rows] = await Promise.all([prisma.questionItem.count({ where }), prisma.questionItem.findMany({ where, orderBy, skip, take: PAGE_SIZE, select })]);
  }
  const items = rows.map(({ imageKey, content, ...r }) => ({ ...r, content: parseContent(content), hasImage: !!imageKey }));
  return { total, items, pageSize: PAGE_SIZE };
}

/** Özet sayıları ve filtre seçenekleri: dersler, ders → konular, türlere göre sayılar. */
export async function bankSummary(ownerId: string) {
  const [total, noAnswer, groups, types] = await Promise.all([
    prisma.questionItem.count({ where: { ownerId } }),
    prisma.questionItem.count({ where: { ownerId, ...NO_ANSWER } }),
    prisma.questionItem.groupBy({ by: ["subject", "topic"], where: { ownerId }, _count: { _all: true } }),
    prisma.questionItem.groupBy({ by: ["type"], where: { ownerId }, _count: { _all: true } }),
  ]);
  const topics: Record<string, string[]> = {};
  for (const g of groups) {
    (topics[g.subject] ??= []);
    if (g.topic) topics[g.subject].push(g.topic);
  }
  for (const s of Object.keys(topics)) topics[s].sort((a, b) => a.localeCompare(b, "tr"));
  const subjects = Object.keys(topics).sort((a, b) => a.localeCompare(b, "tr"));
  const byType = Object.fromEntries(types.map((t) => [t.type, t._count._all])) as Partial<Record<QuestionType, number>>;
  return { total, noAnswer, subjects, topics, byType };
}

/**
 * Seçili soruların alanlarını toplu günceller; başka kurumun soruları atlanır.
 * Cevap her sorunun türüne göre denetlenir: ör. toplu "C" yalnızca çoktan seçmelilere (şık sayısı yetiyorsa) yazılır.
 * Boşluk doldurma ve açık uçlunun cevabı buradan değişmez (serbest metindir; yazma ekranında düzenlenir).
 */
export async function updateItems(ownerId: string, ids: unknown, patch: unknown) {
  if (!Array.isArray(ids) || !ids.length) throw invalid("Soru seçin.");
  const p = (patch ?? {}) as Record<string, unknown>;
  const data = cleanPatch(p);
  const hasAnswer = "answer" in p;
  if (!Object.keys(data).length && !hasAnswer) throw invalid("Değiştirilecek alan yok.");
  const where = { ownerId, id: { in: ids.map(String) } };
  let updated = 0;
  if (Object.keys(data).length) updated = (await prisma.questionItem.updateMany({ where, data })).count;
  if (!hasAnswer) return { updated, skipped: 0 };

  const raw = p.answer;
  const rows = await prisma.questionItem.findMany({ where, select: { id: true, type: true, content: true } });
  const groups = new Map<string, string[]>();
  let skipped = 0;
  for (const r of rows) {
    const t = isQuestionType(r.type) ? r.type : "MC";
    const value = t === "MC" || t === "TF" ? normalizeAnswer(t, raw, parseContent(r.content)?.options?.length) : "";
    if (t === "FILL" || t === "OPEN" || (String(raw ?? "").trim() && !value)) {
      skipped++;
      continue;
    }
    groups.set(value, [...(groups.get(value) ?? []), r.id]);
  }
  for (const [answer, list] of groups) await prisma.questionItem.updateMany({ where: { ownerId, id: { in: list } }, data: { answer } });
  if (!Object.keys(data).length && skipped === rows.length && rows.length)
    throw invalid(rows.length === 1 ? "Bu cevap sorunun türüne uymuyor." : `Bu cevap seçili soruların türüne uymuyor (${QUESTION_TYPES.MC.label.toLocaleLowerCase("tr")} sorulara uygulanır).`);
  return { updated: Math.max(updated, rows.length - skipped), skipped };
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
  const f = it?.imageKey ? await getFile(ownerId, it.imageKey) : null;
  if (!f) throw notFound("Görsel bulunamadı.");
  return f;
}
