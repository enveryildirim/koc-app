import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { bookletCount, bookletLetters, choicesFor, EXAM_TYPES, gradeExam, LETTERS, parseSections, resolveScoring, setBooklet, trimBooklets, type AltBooklet, type ExamSection } from "../domain";

/** İstekteki kitapçık sayısı (1–4); booklets yoksa eski bookletB alanı, o da yoksa fallback. */
function bookletInput(body: Record<string, unknown>, fallback: number) {
  if (body.booklets !== undefined) {
    const n = Math.round(Number(body.booklets));
    if (!(n >= 1 && n <= 4)) throw invalid("Kitapçık sayısı 1 ile 4 arasında olmalı.");
    return n;
  }
  if (typeof body.bookletB === "boolean") return body.bookletB ? Math.max(2, fallback) : 1;
  return fallback;
}

/** Kitapçık sayısının veritabanı alanları. */
export const bookletFields = (n: number) => ({ bookletB: n > 1, booklets: Math.max(2, n) });

/** Kurumun denemesi (bölümler ayrıştırılmış, puanlama çözülmüş, sonuç sayısıyla); yoksa / başka kurumunsa null. */
export async function findExam(ownerId: string, id: string) {
  const exam = await prisma.exam.findFirst({ where: { id, ownerId }, include: { _count: { select: { results: true } } } });
  if (!exam) return null;
  const { _count, ...rest } = exam;
  const secs = parseSections(rest.sections);
  const letters = bookletLetters(bookletCount(rest));
  return { ...rest, secs, letters, scoringResolved: resolveScoring(rest.type, secs, rest.scoring), resultCount: _count.results };
}

/** Kurumun denemesi; yoksa / başka kurumunsa notFound("Bulunamadı."). */
export async function getExam(ownerId: string, id: string) {
  const exam = await findExam(ownerId, id);
  if (!exam) throw notFound();
  return exam;
}

/** Kurumun denemeleri tarihe göre (varsayılan yeniden eskiye), her biri katılım sayısı ve ortalama toplam netiyle. */
export async function listExams(ownerId: string, order: "asc" | "desc" = "desc") {
  const [exams, stats] = await Promise.all([
    prisma.exam.findMany({ where: { ownerId }, orderBy: { date: order } }),
    prisma.examResult.groupBy({ by: ["examId"], where: { exam: { ownerId } }, _count: true, _avg: { totalNet: true } }),
  ]);
  const byExam = new Map(stats.map((s) => [s.examId, s]));
  return exams.map((e) => {
    const s = byExam.get(e.id);
    return { ...e, secs: parseSections(e.sections), resultCount: s?._count ?? 0, avgNet: s ? (s._avg.totalNet ?? 0) : null };
  });
}

/** Yeni deneme: türün şablon bölümleriyle (anahtarlar boş). */
export async function createExam(ownerId: string, body: Record<string, unknown>) {
  const type = typeof body.type === "string" && EXAM_TYPES[body.type] ? body.type : "SERBEST";
  const t = EXAM_TYPES[type];
  const name = String(body.name ?? "").trim();
  if (!name) throw invalid("Sınav adı gerekli.");
  const sections = t.sections.map((s) => ({ name: s.name, count: s.count, keyA: "", keyB: "" }));
  return prisma.exam.create({
    data: {
      ownerId,
      name,
      type,
      date: body.date ? new Date(String(body.date)) : new Date(),
      sections: JSON.stringify(sections),
      ...bookletFields(bookletInput(body, 2)),
      wrongPer: t.wrongPer,
    },
  });
}

type SecIn = { name: string; count: number; keyA: string; keyB?: string; keyC?: string; keyD?: string; topics?: string[]; bOrder?: unknown; cOrder?: unknown; dOrder?: unknown; items?: unknown };

/**
 * Deneme ayarlarını ve cevap anahtarını kaydeder, ardından tüm sonuçları yeni anahtar/puanlamayla yeniden hesaplar.
 * Şıklar sınav türüne göre doğrulanır; B kitapçığı eşlemesi her soruyu bir kez içermeli; toplam ≤ 180 soru.
 */
export async function updateExam(ownerId: string, id: string, body: Record<string, unknown>) {
  const exam = await getExam(ownerId, id);
  if (!Array.isArray(body.sections)) throw invalid("Geçersiz istek.");
  const allowed = LETTERS.slice(0, choicesFor(exam.type));
  const clean = (k: string, n: number) =>
    String(k ?? "")
      .toUpperCase()
      .replace(/[^A-E]/g, "")
      .slice(0, n);

  const n = bookletInput(body, bookletCount(exam));
  const letters = bookletLetters(n);
  const alts = letters.filter((b): b is AltBooklet => b !== "A");

  // Kitapçık sayısı azalıyorsa, kaldırılan kitapçıkla kaydedilmiş sonuç olmamalı (yoksa A anahtarıyla puanlanırdı).
  const orphan = await prisma.examResult.groupBy({ by: ["booklet"], where: { examId: id, booklet: { notIn: letters } }, _count: true });
  if (orphan.length) {
    const list = orphan.map((o) => `${o.booklet} kitapçıklı ${o._count} sonuç`).join(", ");
    throw invalid(`Bu denemede ${list} var. Kitapçık sayısını azaltmadan önce bu sonuçları silin.`);
  }

  const orderOf = (raw: unknown, count: number, name: string, b: string) => {
    if (!Array.isArray(raw) || !raw.length) return undefined;
    const o = raw.map(Number);
    const ok = o.length === count && new Set(o).size === count && o.every((i) => Number.isInteger(i) && i >= 0 && i < count);
    if (!ok) throw invalid(`${name}: ${b} kitapçığı eşlemesi 1–${count} arası her soruyu bir kez içermeli.`);
    return o;
  };

  const sections = (body.sections as SecIn[]).map((s, si) => {
    const count = Math.max(1, Math.min(120, Number(s.count) || 1));
    const name = String(s.name ?? "").trim() || "Bölüm";
    // Havuz soruları yalnızca soru sayısı değişmediyse korunur (gönderilmediyse kayıttakiler).
    const rawItems = Array.isArray(s.items) ? s.items : exam.secs[si]?.items;
    const items = Array.isArray(rawItems) && rawItems.length === count ? rawItems.map((x) => String(x).slice(0, 40)) : undefined;
    const topics = Array.isArray(s.topics) ? Array.from({ length: count }, (_, i) => String(s.topics![i] ?? "").trim().slice(0, 80)) : undefined;
    let sec: ExamSection = {
      name,
      count,
      keyA: clean(s.keyA, count),
      keyB: "",
      ...(topics?.some(Boolean) ? { topics } : {}),
      ...(items ? { items } : {}),
    };
    const raw = { B: [s.keyB, s.bOrder], C: [s.keyC, s.cOrder], D: [s.keyD, s.dOrder] } as const;
    for (const b of alts) {
      const [k, o] = raw[b];
      sec = setBooklet(sec, b, clean(String(k ?? ""), count), orderOf(o, count, name, b));
    }
    return trimBooklets(sec, n);
  });
  for (const s of sections) {
    const keys = [s.keyA, s.keyB, s.keyC ?? "", s.keyD ?? ""].join("");
    for (const ch of keys) {
      if (!allowed.includes(ch)) throw invalid(`${s.name}: '${ch}' bu sınav türünde geçerli bir şık değil (${allowed}).`);
    }
  }
  const total = sections.reduce((a, s) => a + s.count, 0);
  if (total > 180) throw invalid("Toplam soru sayısı en fazla 180 olabilir.");

  await prisma.exam.update({
    where: { id },
    data: {
      name: String(body.name ?? exam.name).trim() || exam.name,
      date: body.date ? new Date(String(body.date)) : exam.date,
      ...bookletFields(n),
      wrongPer: Math.max(0, Math.min(10, Number(body.wrongPer ?? exam.wrongPer))),
      sections: JSON.stringify(sections),
      scoring: scoringJson(body.scoring, sections.length),
    },
  });
  await regrade(id);
}

/** Denemeyi (ve sonuçlarını) siler. */
export async function deleteExam(ownerId: string, id: string) {
  await getExam(ownerId, id);
  await prisma.exam.delete({ where: { id } });
}

/** Cevap anahtarı / puanlama değişince tüm sonuçları yeniden hesaplar. */
async function regrade(examId: string) {
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: { results: true } });
  const secs = parseSections(exam.sections);
  const scoring = resolveScoring(exam.type, secs, exam.scoring);
  for (const r of exam.results) {
    const g = gradeExam(secs, r.answers, r.booklet, exam.wrongPer, scoring);
    await prisma.examResult.update({ where: { id: r.id }, data: { stats: JSON.stringify(g.stats), totalNet: g.totalNet, score: g.score } });
  }
}

/** { base, coefs } doğrulanır; geçersiz veya bölüm sayısıyla uyuşmuyorsa "" (= türün varsayılanı). */
function scoringJson(v: unknown, n: number) {
  if (!v || typeof v !== "object") return "";
  const { base, coefs } = v as { base: unknown; coefs: unknown };
  if (!Array.isArray(coefs) || coefs.length !== n) return "";
  const nums = coefs.map(Number);
  if (!Number.isFinite(Number(base)) || nums.some((c) => !Number.isFinite(c) || c < 0 || c > 100)) return "";
  return JSON.stringify({ base: Number(base), coefs: nums });
}
