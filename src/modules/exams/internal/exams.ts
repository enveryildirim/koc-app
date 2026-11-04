import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { choicesFor, EXAM_TYPES, gradeExam, LETTERS, parseSections, resolveScoring } from "../domain";

/** Kurumun denemesi (bölümler ayrıştırılmış, puanlama çözülmüş, sonuç sayısıyla); yoksa / başka kurumunsa null. */
export async function findExam(ownerId: string, id: string) {
  const exam = await prisma.exam.findFirst({ where: { id, ownerId }, include: { _count: { select: { results: true } } } });
  if (!exam) return null;
  const { _count, ...rest } = exam;
  const secs = parseSections(rest.sections);
  return { ...rest, secs, scoringResolved: resolveScoring(rest.type, secs, rest.scoring), resultCount: _count.results };
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
      bookletB: body.bookletB !== false,
      wrongPer: t.wrongPer,
    },
  });
}

type SecIn = { name: string; count: number; keyA: string; keyB: string; topics?: string[]; bOrder?: number[] };

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

  const sections = (body.sections as SecIn[]).map((s) => {
    const count = Math.max(1, Math.min(120, Number(s.count) || 1));
    const topics = Array.isArray(s.topics) ? Array.from({ length: count }, (_, i) => String(s.topics![i] ?? "").trim().slice(0, 80)) : undefined;
    const bOrder = Array.isArray(s.bOrder) && s.bOrder.length ? s.bOrder.map(Number) : undefined;
    return {
      name: String(s.name ?? "").trim() || "Bölüm",
      count,
      keyA: clean(s.keyA, count),
      keyB: clean(s.keyB, count),
      ...(topics?.some(Boolean) ? { topics } : {}),
      ...(bOrder ? { bOrder } : {}),
    };
  });
  for (const s of sections) {
    for (const ch of s.keyA + s.keyB) {
      if (!allowed.includes(ch)) throw invalid(`${s.name}: '${ch}' bu sınav türünde geçerli bir şık değil (${allowed}).`);
    }
    if (s.bOrder) {
      const ok = s.bOrder.length === s.count && new Set(s.bOrder).size === s.count && s.bOrder.every((i) => Number.isInteger(i) && i >= 0 && i < s.count);
      if (!ok) throw invalid(`${s.name}: B kitapçığı eşlemesi 1–${s.count} arası her soruyu bir kez içermeli.`);
    }
  }
  const total = sections.reduce((a, s) => a + s.count, 0);
  if (total > 180) throw invalid("Toplam soru sayısı en fazla 180 olabilir.");

  await prisma.exam.update({
    where: { id },
    data: {
      name: String(body.name ?? exam.name).trim() || exam.name,
      date: body.date ? new Date(String(body.date)) : exam.date,
      bookletB: typeof body.bookletB === "boolean" ? body.bookletB : exam.bookletB,
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
