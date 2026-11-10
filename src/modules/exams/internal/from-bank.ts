import { prisma } from "@/shared/db";
import { invalid } from "@/shared/errors";
import { bankItemsByIds } from "@/modules/question-bank/server";
import { isOptical, opticalLetter, QUESTION_TYPES, type QuestionType } from "@/modules/question-bank";
import { bookletLetters, choicesFor, EXAM_TYPES, LETTERS, makeBooklet, orderFor, setBooklet, type AltBooklet, type ExamSection } from "../domain";
import { bookletFields } from "./exams";
import { findCourse } from "@/modules/schedule/server";

/**
 * Soru havuzundan deneme: her bölüm için seçilen soruların cevapları A anahtarını, konuları konu listesini oluşturur.
 * A dışındaki her kitapçıkta (B, C, D) sorular bölüm içinde ayrı ayrı karıştırılır (anahtar + eşleme).
 * D/Y soruları optikte A = Doğru, B = Yanlış olarak okunur. Açık uçlu ve boşluk doldurma optikle okunamadığı için
 * yalnızca çalışma kağıdına girer. Kullanım geçmişi denemelerden hesaplanır (for-bank.ts > bankUsage).
 *
 * body: { name, type, date, booklets (1–4), sections: [{ name, items: string[] }] }
 */
export async function createExamFromBank(ownerId: string, body: Record<string, unknown>) {
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
  if (!Array.isArray(body.sections) || !body.sections.length) throw invalid("En az bir bölüm gerekli.");
  const n = body.booklets !== undefined ? Math.round(Number(body.booklets)) : body.bookletB === false ? 1 : 2;
  if (!(n >= 1 && n <= 4)) throw invalid("Kitapçık sayısı 1 ile 4 arasında olmalı.");
  const alts = bookletLetters(n).filter((b): b is AltBooklet => b !== "A");

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

  const found = new Map((await bankItemsByIds(ownerId, all)).map((q) => [q.id, q]));
  if (found.size !== all.length) throw invalid("Seçilen sorulardan bazıları havuzda bulunamadı. Sayfayı yenileyin.");
  const allowed = LETTERS.slice(0, choicesFor(type));

  const sections: ExamSection[] = filled.map((s) => {
    const qs = s.ids.map((id) => found.get(id)!);
    if (purpose === "EXAM") {
      const open = qs.findIndex((q) => !isOptical(q.type));
      if (open >= 0)
        throw invalid(`${s.name}: ${open + 1}. soru ${QUESTION_TYPES[qs[open].type as QuestionType]?.label.toLocaleLowerCase("tr") ?? "optikle okunamayan türde"}; sınavda yalnızca çoktan seçmeli ve doğru / yanlış sorular olabilir. Çalışma kağıdı seçebilirsiniz.`);
      const wide = qs.findIndex((q) => (q.content?.options?.length ?? 0) > allowed.length);
      if (wide >= 0) throw invalid(`${s.name}: ${wide + 1}. soruda ${qs[wide].content!.options!.length} şık var; bu sınav türünde en fazla ${allowed.length} şık olur.`);
    }
    const keys = qs.map((q) => opticalLetter(q.type, q.answer));
    // Çalışma kağıdında cevap zorunlu değil; eksik cevap anahtarda boşluk olarak kalır
    const missing = keys.findIndex((k) => !k);
    if (missing >= 0 && purpose === "EXAM") throw invalid(`${s.name}: ${missing + 1}. sorunun cevabı girilmemiş.`);
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
    for (const b of alts) {
      const m = makeBooklet(keyA, Math.floor(Math.random() * 233280));
      sec = setBooklet(sec, b, m.key, m.order);
    }
    return sec;
  });

  const date = body.date ? new Date(String(body.date)) : new Date();
  const exam = await prisma.exam.create({
    data: {
      ownerId,
      name,
      type,
      date: isNaN(date.getTime()) ? new Date() : date,
      sections: JSON.stringify(sections),
      ...bookletFields(n),
      wrongPer: EXAM_TYPES[type].wrongPer,
      purpose,
      courseId,
    },
  });
  return { id: exam.id };
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
        return q ? { id: q.id, widthMm: widthOf(q.crop), type: q.type, content: q.content, hasImage: q.hasImage, answer: q.answer } : null;
      }),
    };
  });
}
