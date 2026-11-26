import type { Prisma } from "@prisma/client";
import { prisma } from "@/shared/db";
import { invalid, needsConfirm, notFound } from "@/shared/errors";
import { getFile, putFile, removeFiles, sniff } from "@/shared/storage";
import { normalizeLevel } from "@/shared/cognitive";
import { matchOutcome, subjectKey, topicKey, type OutcomeRow } from "@/modules/curriculum";
import { curriculumOutcomes } from "@/modules/curriculum/server";
import { listCourses } from "@/modules/schedule/server";
import {
  ANSWERS,
  countBlanks,
  isQuestionType,
  LIMITS,
  MAX_OPTIONS,
  needsAnswer,
  normalizeAnswer,
  OPTION_LETTERS,
  parseContent,
  plainText,
  QUESTION_TYPES,
  searchKey,
  splitFill,
  TEXT_LIMITS,
  type Crop,
  type QuestionContent,
  type QuestionMeta,
  type QuestionPatch,
  type QuestionType,
  type WrittenMeta,
  isBasis,
  SIMILAR_KINDS,
  stripEmphasis,
} from "../index";
import { similarForDrafts, similarForItems } from "./similar";
import { hashDistance, IMAGE_SAME, imageHash } from "./image-hash";

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

type Tags = { subject: string; grade: string; topic: string };

/**
 * Yazılış birleştirici: (ders, düzey, konu) → { subject, topic, curriculumTopicId }. Bir istek boyunca tek sorgu takımı.
 * - Ders adı: Dersler'deki yazılış, yoksa müfredattaki, yoksa havuzda en sık kullanılan ("ilmihal" → "İlmihal").
 * - Konu: müfredat satırına bağlanırsa oradaki yazılış (kazanım bağı da kurulur); bağlanmazsa aynı derste havuzda
 *   en sık kullanılan yazılış ("kesirler" → "Kesirler"). Karşılaştırma büyük/küçük harf, şapka ve noktalama gözetmez.
 */
async function canonizer(ownerId: string) {
  const [rows, courses, used] = await Promise.all([
    curriculumOutcomes(ownerId),
    listCourses(ownerId),
    prisma.questionItem.groupBy({ by: ["subject", "topic"], where: { ownerId }, _count: { _all: true } }),
  ]);
  // Eşit sayıda kullanılan iki yazılıştan büyük harfle başlayan seçilir
  const byUse = [...used].sort((x, y) => y._count._all - x._count._all || (/^\p{Lu}/u.test(y.topic) ? 1 : 0) - (/^\p{Lu}/u.test(x.topic) ? 1 : 0));
  const subjects = new Map<string, string>();
  const addSubject = (n: string) => {
    if (n.trim() && !subjects.has(subjectKey(n))) subjects.set(subjectKey(n), n.trim());
  };
  courses.filter((c) => c.kind !== "STUDY").forEach((c) => addSubject(c.name));
  rows.forEach((r) => addSubject(r.subject));
  const subjectUse = new Map<string, number>();
  for (const u of used) subjectUse.set(u.subject, (subjectUse.get(u.subject) ?? 0) + u._count._all);
  [...subjectUse].sort((x, y) => y[1] - x[1]).forEach(([n]) => addSubject(n));
  const topics = new Map<string, string>();
  for (const u of byUse) {
    const k = `${subjectKey(u.subject)}|${topicKey(u.topic)}`;
    if (u.topic && !topics.has(k)) topics.set(k, u.topic);
  }
  return (t: Tags) => {
    const subject = subjects.get(subjectKey(t.subject)) ?? t.subject;
    const r = matchOutcome(rows, { subject, grade: t.grade, topic: t.topic });
    const topic = r?.topic ?? (t.topic ? (topics.get(`${subjectKey(subject)}|${topicKey(t.topic)}`) ?? t.topic) : "");
    return { subject, topic, curriculumTopicId: r?.id ?? null };
  };
}

/** Ders + konu + metin + kaynak notundan arama anahtarı (searchText). */
const searchOf = (c: { subject: string; topic: string }, text: string, sourceNote = "") => searchKey(`${c.subject}\n${c.topic}\n${text}\n${sourceNote}`);

/** Çözüm: satır sonları korunur, baştaki / sondaki boşluk atılır. */
const cleanExplanation = (v: unknown) => String(v ?? "").replace(/\r\n?/g, "\n").trim().slice(0, TEXT_LIMITS.explanation);
const cleanSourceNote = (v: unknown) => str(v, TEXT_LIMITS.sourceNote).replace(/\s+/g, " ");

/**
 * Havuzu toparlar (havuz açılırken çağrılır): ders ve konu yazılışlarını birleştirir, kazanım bağını yeniler (müfredat sonradan
 * yüklendiyse bağlanır, satırı silinirse boşalır), arama anahtarını günceller. Yalnızca değişen sorular yazılır; sayısını döndürür.
 */
export async function tidyBank(ownerId: string) {
  const [canon, items] = await Promise.all([
    canonizer(ownerId),
    prisma.questionItem.findMany({ where: { ownerId }, select: { id: true, subject: true, grade: true, topic: true, text: true, sourceNote: true, curriculumTopicId: true, searchText: true } }),
  ]);
  let changed = 0;
  for (const it of items) {
    const c = canon(it);
    const searchText = searchOf(c, it.text, it.sourceNote);
    if (c.subject === it.subject && c.topic === it.topic && c.curriculumTopicId === it.curriculumTopicId && searchText === it.searchText) continue;
    await prisma.questionItem.update({ where: { id: it.id }, data: { ...c, searchText } });
    changed++;
  }
  return changed;
}

type Patch = Omit<QuestionPatch, "answer" | "archived" | "approved"> & { archivedAt?: Date | null; needsReview?: false };


/** Düzenlenebilir alanları doğrular; yalnızca gönderilen alanları döndürür (cevap türe göre ayrıca denetlenir). */
function cleanPatch(p: Record<string, unknown>): Patch {
  const out: Patch = {};
  if ("archived" in p) out.archivedAt = p.archived ? new Date() : null;
  if (p.approved === true) out.needsReview = false;
  if ("subject" in p) {
    out.subject = str(p.subject, 60);
    if (!out.subject) throw invalid("Ders boş olamaz.");
  }
  if ("topic" in p) out.topic = str(p.topic, 120);
  if ("grade" in p) out.grade = str(p.grade, 20);
  if ("difficulty" in p) out.difficulty = cleanDifficulty(p.difficulty);
  if ("level" in p) out.level = normalizeLevel(p.level);
  if ("explanation" in p) out.explanation = cleanExplanation(p.explanation);
  if ("sourceNote" in p) out.sourceNote = cleanSourceNote(p.sourceNote);
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
export async function createItems(ownerId: string, sourceId: string | null, metas: unknown, images: Uint8Array[], opts: { allowSimilar?: boolean } = {}) {
  if (!Array.isArray(metas) || metas.length !== images.length) throw invalid("Soru bilgileri ile görseller eşleşmiyor.");
  if (!metas.length) throw invalid("Kaydedilecek soru yok.");
  if (metas.length > LIMITS.batch) throw invalid(`Tek seferde en fazla ${LIMITS.batch} soru kaydedilebilir.`);
  if (sourceId && !(await prisma.questionSource.findFirst({ where: { id: sourceId, ownerId }, select: { id: true } })))
    throw notFound("Kaynak bulunamadı.");

  checkImages(images);
  const canon = await canonizer(ownerId);
  const rows = (metas as QuestionMeta[]).map((m) => {
    const crop = cleanCrop(m.crop);
    const page = Number.isInteger(m.page) && m.page! > 0 ? m.page! : null;
    const tags = cleanTags(m);
    const c = canon(tags);
    const sourceNote = cleanSourceNote(m.sourceNote);
    return {
      ...tags,
      ...c,
      sourceNote,
      searchText: searchOf(c, "", sourceNote),
      answer: cleanAnswer(m.answer),
      origin: ORIGINS.has(String(m.origin)) ? String(m.origin) : "MANUAL",
      page: sourceId ? page : null,
      crop: sourceId && crop ? JSON.stringify(crop) : "",
    };
  });

  // Görsel parmak izi: aynı görsel havuzda (ya da bu gönderimde) daha önce kesilmişse kayıt onay ister
  const hashes = await Promise.all(images.map(imageHash));
  if (!opts.allowSimilar) {
    const known = await prisma.questionItem.findMany({
      where: { ownerId, content: "", imageHash: { not: "" } },
      select: { imageHash: true, page: true, source: { select: { name: true } } },
    });
    const many = rows.length > 1;
    const dup = hashes.flatMap((h, i) => {
      const k = known.find((x) => hashDistance(h, x.imageHash) <= IMAGE_SAME);
      const j = hashes.findIndex((x, n) => n < i && hashDistance(h, x) <= IMAGE_SAME);
      const who = many ? `${i + 1}. soru` : "Bu soru";
      if (k) return [`${who} havuzda zaten var${k.source ? ` (${k.source.name}${k.page ? `, s. ${k.page}` : ""})` : ""}.`];
      return j >= 0 ? [`${who}, ${j + 1}. soruyla aynı görsel.`] : [];
    });
    if (dup.length) throw needsConfirm([...dup.slice(0, 3), dup.length > 3 ? `ve ${dup.length - 3} soru daha.` : ""].filter(Boolean).join(" "));
  }
  const keys = await storeImages(ownerId, images);
  try {
    await prisma.questionItem.createMany({ data: rows.map((r, i) => ({ ...r, ownerId, sourceId, imageKey: keys[i], imageHash: hashes[i] })) });
  } catch (e) {
    await removeFiles(ownerId, keys);
    throw e;
  }
  return { created: rows.length };
}

function checkImages(images: (Uint8Array | null)[]) {
  images.forEach((b, i) => {
    if (!b) return;
    const at = images.length > 1 ? `${i + 1}. soru: ` : "";
    const k = sniff(b);
    if (!k || k === "pdf") throw invalid(`${at}Soru görseli PNG, JPG ya da WEBP olmalı.`);
    if (b.length > LIMITS.cropMB * 1024 * 1024) throw invalid(`${at}Soru görseli en fazla ${LIMITS.cropMB} MB olabilir.`);
  });
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
 * Kaydı kimin yazdığı: AI (MCP üzerinden bir yapay zekâ agent'ı) ise soru onay bekler.
 * allowSimilar: elle yazmada havuzdaki bir soruyla "Aynı soru" çıkarsa kayıt onay ister (409 + confirm); kullanıcı onaylarsa true gelir.
 */
export type WrittenBy = { origin?: "MANUAL" | "AI"; allowSimilar?: boolean };

const short = (s: string, n = 70) => {
  const t = stripEmphasis(s).replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t || "(görselli soru)";
};

/**
 * Elle yazılan ya da yapıştırılıp bölünen soruları kaydeder. images[i]: i. sorunun isteğe bağlı görseli (yoksa null).
 * Hatalı bir soru varsa hiçbiri kaydedilmez; ileti sorunun sırasını söyler.
 * `by.origin = "AI"`: soru "onay bekliyor" olarak kaydedilir (öğretmen onaylayana kadar havuzda ve sınav kurarken görünmez).
 */
export async function createWrittenItems(ownerId: string, metas: unknown, images: (Uint8Array | null)[], by: WrittenBy = {}) {
  const ai = by.origin === "AI";
  if (!Array.isArray(metas) || !metas.length) throw invalid("Kaydedilecek soru yok.");
  if (metas.length > LIMITS.batch) throw invalid(`Tek seferde en fazla ${LIMITS.batch} soru kaydedilebilir.`);
  checkImages(images);
  const canon = await canonizer(ownerId);
  const many = metas.length > 1;
  const rows = (metas as WrittenMeta[]).map((m, i) => {
    const label = many ? `${i + 1}. soru` : "";
    try {
      const w = cleanWritten(m, !!images[i], label);
      // Elle yazarken cevap sonradan girilebilir; yapay zekâdan gelen soruda eksik ya da geçersiz cevap hata sayılır (agent düzeltsin)
      if (ai && needsAnswer(w.type) && !w.answer)
        throw invalid(
          w.type === "MC" ? `Cevap eksik ya da geçersiz; şıklardan birinin harfi olmalı (A–${OPTION_LETTERS[(w.content.options?.length ?? 2) - 1]}).`
          : w.type === "TF" ? 'Cevap eksik ya da geçersiz; "D" (doğru) ya da "Y" (yanlış) olmalı.'
          : "Cevap eksik; her boşluk için bir cevap girin.",
        );
      const basis = ai ? (isBasis(m.basis) ? m.basis : "original") : "";
      // Çözümü yazmak agent'ı soruyu gerçekten çözmeye zorlar; öğretmen de anahtarı çözümle karşılaştırır.
      // Kaynaktan olduğu gibi aktarılan soruda kaynakta çözüm olmayabilir: isteğe bağlı
      if (ai && basis !== "transcribed" && !cleanExplanation(m.explanation)) throw invalid("Çözüm (explanation) eksik; her sorunun çözümünü yazın.");
      const tags = cleanTags(m);
      const c = canon(tags);
      const extra = { explanation: cleanExplanation(m.explanation), sourceNote: cleanSourceNote(m.sourceNote) };
      const agentNote = ai ? String(m.agentNote ?? "").replace(/\r\n?/g, "\n").trim().slice(0, TEXT_LIMITS.agentNote) : "";
      // Uyarlanan / yeni yazılan sorunun cevabını agent bulmuştur; aktarılanda kaynağın anahtarı mı, agent mı (bilinmiyorsa boş)
      const answerBy = !ai ? "" : basis !== "transcribed" ? "agent" : m.answerBy === "key" || m.answerBy === "agent" ? m.answerBy : "";
      return { ...tags, ...c, ...extra, agentNote, basis, answerBy, searchText: searchOf(c, w.text, extra.sourceNote), type: w.type, content: JSON.stringify(w.content), text: w.text, answer: w.answer, origin: ai ? "AI" : "MANUAL", needsReview: ai };
    } catch (e) {
      if (label && e instanceof Error && !e.message.startsWith(label)) throw invalid(`${label}: ${e.message}`);
      throw e;
    }
  });
  // Tekrar kontrolü: elle yazmada "Aynı soru" kaydı durdurur (kullanıcı onaylarsa geçer); yapay zekâda kaydedilir, sonuçta bildirilir
  const sim = await similarForDrafts(ownerId, rows.map((r) => ({ subject: r.subject, content: parseContent(r.content) ?? { stem: "" }, type: r.type, answer: r.answer })));
  const nth = (i: number) => (many ? `${i + 1}. soru` : "Bu soru");
  if (!ai && !by.allowSimilar) {
    const same = sim.flatMap((x, i) => {
      const b = x.bank.find((h) => h.kind === "same");
      const d = x.drafts.find((h) => h.kind === "same" && h.index < i);
      const where = (h: { pending: boolean; archived: boolean }) => (h.archived ? " (arşivde)" : h.pending ? " (onay bekliyor)" : "");
      return b ? [`${nth(i)} havuzdaki “${short(b.stem)}”${where(b)} sorusuyla aynı görünüyor.`] : d ? [`${nth(i)}, ${d.index + 1}. soruyla aynı görünüyor.`] : [];
    });
    if (same.length) throw needsConfirm([...same.slice(0, 3), same.length > 3 ? `ve ${same.length - 3} soru daha.` : ""].filter(Boolean).join(" "));
  }
  const keys = await storeImages(ownerId, rows.map((_, i) => images[i] ?? null));
  let ids: string[];
  try {
    ids = await prisma.$transaction(rows.map((r, i) => prisma.questionItem.create({ data: { ...r, ownerId, sourceId: null, imageKey: keys[i] }, select: { id: true } }))).then((x) => x.map((r) => r.id));
  } catch (e) {
    await removeFiles(ownerId, keys);
    throw e;
  }
  // Benzerler: havuzdakiler ve aynı gönderimdeki diğer sorular (kayıt sonrası kimlikleriyle)
  const similar = sim.flatMap((x, i) => {
    const list = [
      ...x.bank.map((h) => ({ id: h.id, kind: h.kind, stem: short(h.stem, 120), pending: h.pending, archived: h.archived })),
      ...x.drafts.map((d) => ({ id: ids[d.index], kind: d.kind, stem: short(rows[d.index].text, 120), pending: ai, archived: false })),
    ];
    return list.length ? [{ question: i + 1, id: ids[i], similar: list.map((h) => ({ ...h, label: SIMILAR_KINDS[h.kind].label })) }] : [];
  });
  return { created: rows.length, pendingReview: ai, ids, similar };
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
  const tags = cleanTags(m);
  const linked = (await canonizer(ownerId))(tags);
  const extra = { explanation: cleanExplanation(m.explanation), sourceNote: cleanSourceNote(m.sourceNote) };
  const [key] = img ? await storeImages(ownerId, [img]) : [image === "remove" ? "" : it.imageKey];
  try {
    await prisma.questionItem.update({
      where: { id: it.id },
      data: { ...tags, ...linked, ...extra, searchText: searchOf(linked, w.text, extra.sourceNote), type: w.type, content: JSON.stringify(w.content), text: w.text, answer: w.answer, imageKey: key },
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
    select: {
      id: true, type: true, content: true, answer: true, subject: true, topic: true, grade: true, difficulty: true, level: true, imageKey: true,
      explanation: true, sourceNote: true,
    },
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
  /** "cevap" = cevabı girilmemiş, "konu" = konusu girilmemiş, "kazanim" = müfredata bağlı değil, "cozum" = çözümü yazılmamış */
  missing?: string;
  q?: string;
  /** Yalnızca bu sorular / bu sorular hariç (kullanım süzgeçleri; kullanım exams'ten hesaplanıp verilir) */
  only?: string[];
  except?: string[];
  /** Verilirse bu sıra önce gelir (ör. en çok kullanılan); kalanlar yeniden eskiye */
  rank?: string[];
  /** true: yalnızca arşivdekiler; aksi hâlde arşivdekiler listelenmez */
  archived?: boolean;
  /** true: yalnızca onay bekleyenler (yapay zekâ ile eklenen); aksi hâlde onay bekleyenler listelenmez */
  review?: boolean;
};

const PAGE_SIZE = 120;
/** Cevabı eksik sayılan sorular: açık uçluda örnek cevap isteğe bağlıdır. */
const NO_ANSWER: Prisma.QuestionItemWhereInput = { answer: "", type: { not: "OPEN" } };

/** Süzgeçten veritabanı koşulu (liste ve onay kuyruğu ortak). */
function whereOf(ownerId: string, f: ItemFilter) {
  const where: Prisma.QuestionItemWhereInput = { ownerId, archivedAt: f.archived ? { not: null } : null, needsReview: !!f.review && !f.archived };
  if (f.archived) delete where.needsReview;
  if (f.subject) where.subject = f.subject;
  if (f.topic) where.topic = f.topic;
  if (f.difficulty) where.difficulty = cleanDifficulty(f.difficulty);
  if (f.sourceId) where.sourceId = f.sourceId;
  if (f.type && isQuestionType(f.type)) where.type = f.type;
  if (f.missing === "cevap") Object.assign(where, NO_ANSWER, f.type && isQuestionType(f.type) && f.type !== "OPEN" ? { type: f.type } : {});
  if (f.missing === "konu") where.topic = "";
  if (f.missing === "kazanim") where.curriculumTopicId = null;
  if (f.missing === "cozum") where.explanation = "";
  // Türkçe harflerde büyük/küçük harf ayırmadan: saklanan anahtar ve aranan sözcük aynı işlemden geçer
  if (f.q && searchKey(f.q)) where.searchText = { contains: searchKey(f.q) };
  if (f.only || f.except) where.id = { ...(f.only ? { in: f.only } : {}), ...(f.except ? { notIn: f.except } : {}) };
  return where;
}

/** Havuz listesi (yeniden eskiye, sayfalı) ve filtreye uyan toplam soru sayısı. */
export async function listItems(ownerId: string, f: ItemFilter = {}, page = 1) {
  const where = whereOf(ownerId, f);
  const select = {
    id: true, subject: true, topic: true, grade: true, difficulty: true, level: true, answer: true, origin: true, page: true,
    type: true, content: true, imageKey: true, curriculumTopicId: true, archivedAt: true, explanation: true, sourceNote: true,
    needsReview: true, agentNote: true, basis: true, answerBy: true, transcript: true, transcriptBy: true, source: { select: { name: true } },
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
  const outcomes = rows.some((r) => r.curriculumTopicId) ? new Map((await curriculumOutcomes(ownerId)).map((o) => [o.id, o])) : new Map<string, OutcomeRow>();
  const items = rows.map(({ imageKey, content, curriculumTopicId, archivedAt, transcript, ...r }) => {
    const o = curriculumTopicId ? outcomes.get(curriculumTopicId) : undefined;
    return {
      ...r,
      content: parseContent(content),
      transcript: parseContent(transcript),
      hasImage: !!imageKey,
      archived: !!archivedAt,
      outcome: o ? { code: o.code, text: o.outcome, unit: o.unit } : null,
    };
  });
  return { total, items, pageSize: PAGE_SIZE };
}

/**
 * Özet sayıları ve filtre seçenekleri (arşivdekiler ve onay bekleyenler hariç): dersler, ders → konular, türlere göre sayılar.
 * grades: havuzdaki bütün soruların (onay bekleyen ve arşivdekiler dahil) sınıf / seviyeleri; seçim listeleri bunu da içerir ki kayıtlı değer kaybolmasın.
 * used verilirse (kullanılmış soru kimlikleri, exams > bankUsage) hiç kullanılmamış soru sayısı da döner.
 */
export async function bankSummary(ownerId: string, used?: string[]) {
  const active = { ownerId, archivedAt: null, needsReview: false };
  const [total, noAnswer, archived, pending, unused, groups, types, gradeRows] = await Promise.all([
    prisma.questionItem.count({ where: active }),
    prisma.questionItem.count({ where: { ...active, ...NO_ANSWER } }),
    prisma.questionItem.count({ where: { ownerId, archivedAt: { not: null } } }),
    prisma.questionItem.count({ where: { ownerId, archivedAt: null, needsReview: true } }),
    used ? prisma.questionItem.count({ where: { ...active, id: { notIn: used } } }) : Promise.resolve(null),
    prisma.questionItem.groupBy({ by: ["subject", "topic"], where: active, _count: { _all: true } }),
    prisma.questionItem.groupBy({ by: ["type"], where: active, _count: { _all: true } }),
    prisma.questionItem.groupBy({ by: ["grade"], where: { ownerId } }),
  ]);
  const topics: Record<string, string[]> = {};
  for (const g of groups) {
    (topics[g.subject] ??= []);
    if (g.topic) topics[g.subject].push(g.topic);
  }
  for (const s of Object.keys(topics)) topics[s].sort((a, b) => a.localeCompare(b, "tr"));
  const subjects = Object.keys(topics).sort((a, b) => a.localeCompare(b, "tr"));
  const byType = Object.fromEntries(types.map((t) => [t.type, t._count._all])) as Partial<Record<QuestionType, number>>;
  const grades = gradeRows.map((g) => g.grade).filter(Boolean);
  return { total, noAnswer, archived, pending, unused, subjects, topics, byType, grades };
}

/**
 * Müfredattaki bir konuyla eşleşmeyen sorular (ders, düzey, konu → sayı); müfredat sayfasındaki uyarı için.
 * Kayıtlı bağa değil, müfredatın şimdiki hâline bakar (bağ, havuz açılınca tidyBank ile yenilenir). Konusu boş olanlar sayılmaz.
 * Arşivdekiler ve onay bekleyenler hariç.
 */
export async function unlinkedTopics(ownerId: string) {
  const [rows, groups] = await Promise.all([
    curriculumOutcomes(ownerId),
    prisma.questionItem.groupBy({ by: ["subject", "grade", "topic"], where: { ownerId, archivedAt: null, needsReview: false, topic: { not: "" } }, _count: { _all: true } }),
  ]);
  return groups
    .filter((g) => !matchOutcome(rows, { subject: g.subject, grade: g.grade, topic: g.topic }))
    .map((g) => ({ subject: g.subject, grade: g.grade, topic: g.topic, count: g._count._all }));
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
  if ("subject" in data || "topic" in data || "grade" in data || "sourceNote" in data) {
    const canon = await canonizer(ownerId);
    const rows = await prisma.questionItem.findMany({ where, select: { id: true, subject: true, grade: true, topic: true, text: true, sourceNote: true } });
    for (const r of rows) {
      const c = canon(r);
      await prisma.questionItem.update({ where: { id: r.id }, data: { ...c, searchText: searchOf(c, r.text, r.sourceNote) } });
    }
  }
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

/** Onay kuyruğundaki gruplar (`?onay=`). */
export const REVIEW_GROUPS = {
  tekrar: "Havuzda aynısı var",
  not: "Agent notu var",
  cozdu: "Anahtarsız, agent çözdü",
  cevap: "Cevabı eksik",
  temiz: "Sorunsuz görünen",
} as const;
export type ReviewGroup = keyof typeof REVIEW_GROUPS;
export const isReviewGroup = (v: unknown): v is ReviewGroup => typeof v === "string" && v in REVIEW_GROUPS;

/**
 * Onay bekleyen sorular, süzgece uyanların tümü (sayfasız), gruplara ayrılmış: havuzda aynısı olan, agent notu olan,
 * kaynağında cevap anahtarı olmayıp cevabını agent'ın çözdüğü, cevabı eksik ve bunların hiçbiri olmayan ("sorunsuz görünen"). Bir soru birden fazla grupta olabilir (temiz hariç).
 * Öğretmen önce sorunlu grupları inceler, sorunsuzları toplu onaylar.
 */
export async function reviewQueue(ownerId: string, f: ItemFilter = {}) {
  const rows = await prisma.questionItem.findMany({
    where: whereOf(ownerId, { ...f, review: true, archived: false }),
    orderBy: [{ createdAt: "desc" }, { page: "asc" }],
    select: { id: true, agentNote: true, answer: true, type: true, basis: true, answerBy: true },
  });
  const sim = await similarForItems(ownerId, rows.map((r) => r.id));
  const groups: Record<ReviewGroup, string[]> = { tekrar: [], not: [], cozdu: [], cevap: [], temiz: [] };
  for (const r of rows) {
    const same = sim.get(r.id)?.some((h) => h.kind === "same") ?? false;
    const noted = !!r.agentNote.trim();
    const noAnswer = !r.answer && r.type !== "OPEN";
    // Kaynakta anahtar yoktu, cevabı agent çözdü: öğretmen cevabı kontrol etmeli
    const solved = r.basis === "transcribed" && r.answerBy === "agent" && !noAnswer;
    if (same) groups.tekrar.push(r.id);
    if (noted) groups.not.push(r.id);
    if (solved) groups.cozdu.push(r.id);
    if (noAnswer) groups.cevap.push(r.id);
    if (!same && !noted && !solved && !noAnswer) groups.temiz.push(r.id);
  }
  return { total: rows.length, ids: rows.map((r) => r.id), groups };
}

/**
 * Parmak izi olmayan kesilmiş sorular için parmak izi hesaplar (bu özellikten önce kesilenler). Havuz açılırken çağrılır;
 * bir seferde en fazla `limit` soru (görsel okuma maliyetli). Hesaplanan sayıyı döndürür.
 */
export async function hashMissingImages(ownerId: string, limit = 100) {
  const rows = await prisma.questionItem.findMany({ where: { ownerId, content: "", imageKey: { not: "" }, imageHash: "" }, select: { id: true, imageKey: true }, take: limit });
  let n = 0;
  for (const r of rows) {
    const f = await getFile(ownerId, r.imageKey).catch(() => null);
    // Görsel okunamazsa "-" yazılır, her açılışta yeniden denenmez
    const h = f ? await imageHash(new Uint8Array(f.data)) : "";
    await prisma.questionItem.update({ where: { id: r.id }, data: { imageHash: h || "-" } });
    if (h) n++;
  }
  return n;
}

/** Yazıya geçirilen metin: kök + şıklar (çoktan seçmelide). Formüller düz metin (√, ², π). */
export type TranscriptInput = { id: string; stem: string; options?: string[] };

/**
 * Kesilmiş (yalnızca görsel) sorulara metin yazar. Kitapçıkta soru yine görsel basılır; metin arama ve benzerlik içindir,
 * bu yüzden soru yeniden onaya düşmez (karttaki işaretten kimin çıkardığı görünür).
 * by = "AI": öğretmenin elle yazdığı metnin üzerine yazmaz (`skipped`); "MANUAL": her zaman yazar. Boş kök metni siler.
 */
export async function setTranscripts(ownerId: string, list: TranscriptInput[], by: "AI" | "MANUAL") {
  if (!Array.isArray(list) || !list.length) throw invalid("Metin yok.");
  if (list.length > LIMITS.batch) throw invalid(`Tek seferde en fazla ${LIMITS.batch} soru.`);
  const rows = await prisma.questionItem.findMany({
    where: { ownerId, id: { in: list.map((x) => String(x.id)) } },
    select: { id: true, content: true, subject: true, topic: true, sourceNote: true, transcriptBy: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const many = list.length > 1;
  const updates = list.map((x, i) => {
    const at = many ? `${i + 1}. soru: ` : "";
    const r = byId.get(String(x.id));
    if (!r) throw notFound(`${at}soru bulunamadı (${x.id}).`);
    if (r.content) throw invalid(`${at}bu soru zaten yazılı; metin yalnızca kesilmiş (görsel) sorulara yazılır.`);
    const stem = String(x.stem ?? "").replace(/\r\n?/g, "\n").trim().slice(0, TEXT_LIMITS.stem);
    const options = (Array.isArray(x.options) ? x.options : []).map((o) => str(o, TEXT_LIMITS.option)).filter(Boolean).slice(0, MAX_OPTIONS);
    const content: QuestionContent = options.length ? { stem, options } : { stem };
    return { r, content, empty: !stem };
  });
  let updated = 0;
  const skipped: string[] = [];
  for (const u of updates) {
    if (by === "AI" && u.r.transcriptBy === "MANUAL") {
      skipped.push(u.r.id);
      continue;
    }
    const text = u.empty ? "" : plainText(u.content);
    await prisma.questionItem.update({
      where: { id: u.r.id },
      data: { transcript: u.empty ? "" : JSON.stringify(u.content), transcriptBy: u.empty ? "" : by, text, searchText: searchOf(u.r, text, u.r.sourceNote) },
    });
    updated++;
  }
  return { updated, skipped };
}

/**
 * Metni olmayan kesilmiş sorular (yeniden eskiye), görselleriyle: agent yazıya geçirsin diye (MCP).
 * Arşivdekiler hariç. `total`: süzgece uyan metinsiz soru sayısı.
 */
export async function untranscribedItems(ownerId: string, f: { subject?: string; sourceId?: string; limit?: number } = {}) {
  const where: Prisma.QuestionItemWhereInput = { ownerId, content: "", transcript: "", imageKey: { not: "" }, archivedAt: null };
  if (f.subject) where.subject = f.subject;
  if (f.sourceId) where.sourceId = f.sourceId;
  const take = Math.min(Math.max(1, f.limit ?? 10), 20);
  const [total, rows] = await Promise.all([
    prisma.questionItem.count({ where }),
    prisma.questionItem.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { page: "asc" }],
      take,
      select: { id: true, subject: true, topic: true, grade: true, type: true, answer: true, page: true, imageKey: true, source: { select: { name: true } } },
    }),
  ]);
  const items = [];
  for (const { imageKey, source, ...r } of rows) {
    const file = await getFile(ownerId, imageKey).catch(() => null);
    if (file) items.push({ ...r, source: source?.name ?? "", image: { data: Buffer.from(file.data).toString("base64"), mimeType: file.type } });
  }
  return { total, items };
}

