import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { bankItemsByIds } from "@/modules/question-bank/server";
import { isOptical, opticalLetter, QUESTION_TYPES, type QuestionType } from "@/modules/question-bank";
import { bookletCount, bookletLetters, choicesFor, EXAM_TYPES, LETTERS, makeBooklet, orderFor, parseSections, setBooklet, type AltBooklet, type ExamSection } from "../domain";
import { bookletFields, regrade } from "./exams";
import { findCourse } from "@/modules/schedule/server";

type Meta = { name: string; type: string; purpose: "EXAM" | "WORKSHEET"; courseId: string | null; booklets: number; date: Date };

/** İstekteki deneme bilgileri (ad, tür, amaç, ders, kitapçık sayısı, tarih). */
async function metaOf(ownerId: string, body: Record<string, unknown>): Promise<Meta> {
  const type = typeof body.type === "string" && EXAM_TYPES[body.type] ? body.type : "SERBEST";
  const name = String(body.name ?? "").trim().slice(0, 120);
  const purpose = body.purpose === "WORKSHEET" ? "WORKSHEET" : "EXAM";
  let courseId: string | null = null;
  if (body.courseId) {
    const c = await findCourse(ownerId, String(body.courseId));
    if (!c) throw invalid("Ders bulunamadı.");
    courseId = c.id;
  }
  if (!name) throw invalid("Deneme adı gerekli.");
  const n = body.booklets !== undefined ? Math.round(Number(body.booklets)) : body.bookletB === false ? 1 : 2;
  if (!(n >= 1 && n <= 4)) throw invalid("Kitapçık sayısı 1 ile 4 arasında olmalı.");
  const d = body.date ? new Date(String(body.date)) : new Date();
  return { name, type, purpose, courseId, booklets: n, date: isNaN(d.getTime()) ? new Date() : d };
}

/**
 * Bölümler: seçilen soruların cevapları A anahtarını, konuları konu listesini oluşturur; A dışındaki kitapçıklarda sorular
 * bölüm içinde karıştırılır. `prev` (düzenleme): soruları ve sırası aynı kalan bölümün kitapçık eşlemeleri korunur, önceden
 * denemede olan arşivlenmiş / onay bekleyen sorular kalabilir.
 */
async function bankSections(ownerId: string, body: Record<string, unknown>, m: Meta, prev: ExamSection[] = []) {
  if (!Array.isArray(body.sections) || !body.sections.length) throw invalid("En az bir bölüm gerekli.");
  const alts = bookletLetters(m.booklets).filter((b): b is AltBooklet => b !== "A");
  const input = (body.sections as { name?: unknown; items?: unknown }[]).map((s) => ({
    name: String(s?.name ?? "").trim().slice(0, 60) || "Bölüm",
    ids: Array.isArray(s?.items) ? s.items.map(String) : [],
  }));
  const filled = input.filter((s) => s.ids.length);
  if (!filled.length) throw invalid("Bölümlere soru ekleyin.");
  const all = filled.flatMap((s) => s.ids);
  if (new Set(all).size !== all.length) throw invalid("Aynı soru denemede birden fazla kez kullanılamaz.");
  if (all.length > 180) throw invalid("Toplam soru sayısı en fazla 180 olabilir.");
  if (filled.some((s) => s.ids.length > 120)) throw invalid("Bir bölümde en fazla 120 soru olabilir.");

  const before = new Set(prev.flatMap((s) => s.items ?? []));
  const found = new Map((await bankItemsByIds(ownerId, all)).map((q) => [q.id, q]));
  if (found.size !== all.length) throw invalid("Seçilen sorulardan bazıları havuzda bulunamadı. Sayfayı yenileyin.");
  const fresh = [...found.values()].filter((q) => !before.has(q.id));
  if (fresh.some((q) => q.archived)) throw invalid("Seçilen sorulardan bazıları arşive kaldırılmış. Sayfayı yenileyin.");
  if (fresh.some((q) => q.pending)) throw invalid("Seçilen sorulardan bazıları henüz onaylanmamış. Soru havuzunda onaylayın.");
  const allowed = LETTERS.slice(0, choicesFor(m.type));

  return filled.map((s) => {
    const qs = s.ids.map((id) => found.get(id)!);
    if (m.purpose === "EXAM") {
      const open = qs.findIndex((q) => !isOptical(q.type));
      if (open >= 0)
        throw invalid(`${s.name}: ${open + 1}. soru ${QUESTION_TYPES[qs[open].type as QuestionType]?.label.toLocaleLowerCase("tr") ?? "optikle okunamayan türde"}; sınavda yalnızca çoktan seçmeli ve doğru / yanlış sorular olabilir. Çalışma kağıdı seçebilirsiniz.`);
      const wide = qs.findIndex((q) => (q.content?.options?.length ?? 0) > allowed.length);
      if (wide >= 0) throw invalid(`${s.name}: ${wide + 1}. soruda ${qs[wide].content!.options!.length} şık var; bu sınav türünde en fazla ${allowed.length} şık olur.`);
    }
    const keys = qs.map((q) => opticalLetter(q.type, q.answer));
    // Çalışma kağıdında cevap zorunlu değil; eksik cevap anahtarda boşluk olarak kalır
    const missing = keys.findIndex((k) => !k);
    if (missing >= 0 && m.purpose === "EXAM") throw invalid(`${s.name}: ${missing + 1}. sorunun cevabı girilmemiş.`);
    const bad = keys.findIndex((k) => k && !allowed.includes(k));
    if (bad >= 0) throw invalid(`${s.name}: ${bad + 1}. sorunun cevabı (${keys[bad]}) bu sınav türünde yok (${allowed}).`);
    const keyA = keys.map((k) => k || " ").join("");
    const topics = qs.map((q) => q.topic.slice(0, 80));
    const levels = qs.map((q) => q.level);
    let sec: ExamSection = {
      name: s.name,
      count: qs.length,
      keyA,
      keyB: "",
      ...(topics.some(Boolean) ? { topics } : {}),
      ...(levels.some(Boolean) ? { levels } : {}),
      items: s.ids,
    };
    const same = prev.find((p) => p.items?.length === s.ids.length && p.items.every((id, i) => id === s.ids[i]));
    for (const b of alts) {
      const kept = same && orderFor(same, b);
      const order = kept || makeBooklet(keyA, Math.floor(Math.random() * 233280)).order;
      sec = setBooklet(sec, b, order.map((i) => keyA[i]).join(""), order);
    }
    return sec;
  });
}

/**
 * Soru havuzundan deneme. D/Y soruları optikte A = Doğru, B = Yanlış olarak okunur. Açık uçlu ve boşluk doldurma optikle
 * okunamadığı için yalnızca çalışma kağıdına girer. Kullanım geçmişi denemelerden hesaplanır (for-bank.ts > bankUsage).
 *
 * body: { name, type, date, booklets (1–4), purpose, courseId, sections: [{ name, items: string[] }] }
 */
export async function createExamFromBank(ownerId: string, body: Record<string, unknown>) {
  const m = await metaOf(ownerId, body);
  const sections = await bankSections(ownerId, body, m);
  const exam = await prisma.exam.create({
    data: {
      ownerId,
      name: m.name,
      type: m.type,
      date: m.date,
      sections: JSON.stringify(sections),
      ...bookletFields(m.booklets),
      wrongPer: EXAM_TYPES[m.type].wrongPer,
      purpose: m.purpose,
      courseId: m.courseId,
    },
  });
  return { id: exam.id };
}

/**
 * Havuzdan kurulmuş denemenin sorularını ve bilgilerini değiştirir (aynı body). Sonucu girilmiş denemede soru değişmez:
 * öğrencinin işaretleri soru sırasına bağlı, sorular değişirse cevaplar başka sorulara denk gelir.
 * Tür değişirse yanlış / doğru oranı türün varsayılanına döner. Bölüm yapısı (bölüm sayısı ya da soru sayıları) değişirse
 * puanlama katsayıları ve okuyucu (TXT) biçimi varsayılana döner.
 */
export async function updateExamFromBank(ownerId: string, examId: string, body: Record<string, unknown>) {
  const exam = await prisma.exam.findFirst({ where: { id: examId, ownerId }, include: { _count: { select: { results: true } } } });
  if (!exam) throw notFound("Deneme bulunamadı.");
  const prev = parseSections(exam.sections);
  if (!prev.some((s) => s.items?.length)) throw invalid("Bu deneme soru havuzundan kurulmadığı için soruları buradan değiştirilemez.");
  if (exam._count.results) throw invalid(`Bu denemenin ${exam._count.results} sonucu var; sorular değişirse öğrencilerin cevapları başka sorulara denk gelir. Önce sonuçları silin ya da yeni bir deneme kurun.`);
  const m = await metaOf(ownerId, body);
  const sections = await bankSections(ownerId, body, m, prev);
  const shape = (l: ExamSection[]) => l.map((s) => s.count).join(",");
  const reshaped = shape(prev) !== shape(sections);
  await prisma.exam.update({
    where: { id: examId },
    data: {
      name: m.name,
      type: m.type,
      date: m.date,
      sections: JSON.stringify(sections),
      ...bookletFields(m.booklets),
      purpose: m.purpose,
      courseId: m.courseId,
      ...(m.type !== exam.type ? { wrongPer: EXAM_TYPES[m.type].wrongPer, scoring: "" } : {}),
      ...(reshaped ? { scoring: "", readerFormat: "" } : {}),
    },
  });
  return { id: examId };
}

/**
 * Anahtardaki cevabı havuzdakinden farklı sorular (havuzda cevap sonradan düzeltildiyse). A kitapçığı numarasıyla.
 * Silinmiş, cevapsız ya da anahtarda iptal edilmiş ("?") sorular sayılmaz.
 */
export async function examKeyDrift(ownerId: string, examId: string) {
  const exam = await prisma.exam.findFirst({ where: { id: examId, ownerId }, select: { sections: true } });
  if (!exam) return [];
  const secs = parseSections(exam.sections);
  const found = new Map((await bankItemsByIds(ownerId, secs.flatMap((s) => s.items ?? []))).map((q) => [q.id, q]));
  const out: { section: string; si: number; j: number; no: number; was: string; now: string }[] = [];
  let no = 0;
  secs.forEach((s, si) => {
    const items = s.items ?? [];
    for (let j = 0; j < s.count; j++) {
      no++;
      if (items.length !== s.count) continue;
      const q = found.get(items[j]);
      const now = q ? opticalLetter(q.type, q.answer) : "";
      const was = s.keyA[j] ?? " ";
      if (!now || was === "?" || was === now) continue;
      out.push({ section: s.name, si, j, no, was: was.trim(), now });
    }
  });
  return out;
}

/** Anahtarı havuzdaki cevaplarla eşitler (diğer kitapçıklar eşlemeden), sonuçları yeniden puanlar. Değişen soru sayısını döndürür. */
export async function syncExamKey(ownerId: string, examId: string) {
  const drift = await examKeyDrift(ownerId, examId);
  if (!drift.length) return { changed: 0 };
  const exam = await prisma.exam.findFirstOrThrow({ where: { id: examId, ownerId } });
  const n = bookletCount(exam);
  const alts = bookletLetters(n).filter((b): b is AltBooklet => b !== "A");
  const sections = parseSections(exam.sections).map((s, si) => {
    const mine = drift.filter((d) => d.si === si);
    if (!mine.length) return s;
    const a = s.keyA.padEnd(s.count, " ").split("");
    for (const d of mine) a[d.j] = d.now;
    const keyA = a.join("");
    let sec: ExamSection = { ...s, keyA };
    for (const b of alts) {
      const o = orderFor(s, b);
      if (o) sec = setBooklet(sec, b, o.map((i) => keyA[i]).join(""), o);
    }
    return sec;
  });
  await prisma.exam.update({ where: { id: examId }, data: { sections: JSON.stringify(sections) } });
  await regrade(examId);
  return { changed: drift.length };
}

/** Kaynak sayfa genişliği varsayımı (A4); kesim oranından basılı genişlik hesaplanır. */
const PAGE_MM = 210;

/**
 * Kitapçık sırasıyla bölümlerin soruları. X kitapçığında j. soru = A'daki orderFor(X)[j].
 * widthMm: kesilmiş sorunun kaynaktaki genişliği (biliniyorsa); yazılan soruda content dolu gelir.
 * Havuzdan silinmiş sorular null döner.
 */
export async function bookletOf(ownerId: string, secs: ExamSection[], booklet: string) {
  const ids = secs.flatMap((s) => s.items ?? []);
  const found = new Map((await bankItemsByIds(ownerId, ids)).map((q) => [q.id, q]));
  const widthOf = (crop: string) => {
    try {
      const w = Number(JSON.parse(crop).w);
      return w > 0 && w <= 1 ? Math.round(w * PAGE_MM) : null;
    } catch {
      return null;
    }
  };
  return secs.map((s) => {
    const items = s.items ?? [];
    const order = (items.length === s.count && orderFor(s, booklet)) || items.map((_, i) => i);
    return {
      name: s.name,
      questions: order.map((i) => {
        const q = found.get(items[i]);
        return q ? { id: q.id, widthMm: widthOf(q.crop), type: q.type, content: q.content, hasImage: q.hasImage, answer: q.answer, explanation: q.explanation } : null;
      }),
    };
  });
}
