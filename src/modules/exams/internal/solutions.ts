import { randomBytes } from "node:crypto";
import { prisma } from "@/shared/db";
import { notFound } from "@/shared/errors";
import { bankItemsByIds, itemImage } from "@/modules/question-bank/server";
import { answerLabel } from "@/modules/question-bank";
import { bookletCount, bookletLetters, keyFor, parseSections } from "../domain";
import { bookletOf } from "./from-bank";

/**
 * Çözüm sayfası (girişsiz, `/cozum/<token>`): kitapçığa ve karneye basılan QR'ın açtığı sayfa.
 *
 * - Denemenin anahtarı (`Exam.solutionToken`) bütün soruları açar; kitapçık `k` ile seçilir (numaralar kitapçığa göre).
 * - Sonucun anahtarı (`ExamResult.solutionToken`) yalnızca o öğrencinin yanlış ve boş bıraktığı soruları, kendi kitapçığının
 *   numaralarıyla ve verdiği cevapla açar.
 * - Öğretmen yayınlayana kadar (`solutionsOpen`) sayfa kapalıdır: QR deneme sırasında kitapçığın üstündedir.
 * - Anahtarlar ilk gerektiğinde (kitapçık / karne basılırken) üretilir; tahmin edilemez (144 bit).
 * - Yalnızca havuzdan kurulmuş bölümlerin soruları gösterilir; öğrenci ve sonuç verisinden yalnızca öğrencinin adı görünür.
 */

const newToken = () => randomBytes(18).toString("base64url");

/** Denemenin çözüm anahtarı; yoksa üretir. Deneme kurumun değilse null. */
export async function examSolutionToken(ownerId: string, examId: string) {
  const exam = await prisma.exam.findFirst({ where: { id: examId, ownerId }, select: { solutionToken: true } });
  if (!exam) return null;
  if (exam.solutionToken) return exam.solutionToken;
  const token = newToken();
  await prisma.exam.update({ where: { id: examId }, data: { solutionToken: token } });
  return token;
}

/** Denemedeki her sonucun kişisel çözüm anahtarı (sonuç id → anahtar); eksikleri üretir. */
export async function resultSolutionTokens(ownerId: string, examId: string) {
  const rows = await prisma.examResult.findMany({ where: { examId, exam: { ownerId } }, select: { id: true, solutionToken: true } });
  const out = new Map<string, string>();
  for (const r of rows) {
    const token = r.solutionToken ?? newToken();
    if (!r.solutionToken) await prisma.examResult.update({ where: { id: r.id }, data: { solutionToken: token } });
    out.set(r.id, token);
  }
  return out;
}

/** Çözümleri yayınlar / kapatır. */
export async function setSolutionsOpen(ownerId: string, examId: string, open: boolean) {
  const { count } = await prisma.exam.updateMany({ where: { id: examId, ownerId }, data: { solutionsOpen: open } });
  if (!count) throw notFound("Deneme bulunamadı.");
  if (open) await examSolutionToken(ownerId, examId);
}

const EXAM_SELECT = { id: true, ownerId: true, name: true, date: true, purpose: true, sections: true, bookletB: true, booklets: true, solutionsOpen: true } as const;

/** Anahtarın denemesi (ve kişisel anahtarsa sonucu). Geçersizse null. */
async function resolveToken(token: string) {
  if (!token || token.length > 64) return null;
  const exam = await prisma.exam.findUnique({ where: { solutionToken: token }, select: EXAM_SELECT });
  if (exam) return { exam, result: null };
  const result = await prisma.examResult.findUnique({
    where: { solutionToken: token },
    select: { id: true, booklet: true, answers: true, student: { select: { firstName: true, lastName: true } }, exam: { select: EXAM_SELECT } },
  });
  return result ? { exam: result.exam, result } : null;
}

export type SolutionQuestion = {
  no: number;
  id: string;
  type: string;
  content: Awaited<ReturnType<typeof bankItemsByIds>>[number]["content"];
  hasImage: boolean;
  widthMm: number | null;
  answer: string;
  explanation: string;
  /** Kişisel sayfada öğrencinin cevabı: "" = boş, "Çift" = çift işaret */
  given?: string;
};

/**
 * Anahtarın çözüm sayfası.
 * - `invalid`: anahtar yok;
 * - `closed`: öğretmen henüz yayınlamadı;
 * - `open`: sorular (kişiselse yalnızca yanlış ve boşlar).
 */
export async function solutionsByToken(token: string, bookletParam?: string) {
  const found = await resolveToken(token);
  if (!found) return { state: "invalid" as const };
  const { exam, result } = found;
  const head = { name: exam.name, date: exam.date, worksheet: exam.purpose === "WORKSHEET" };
  if (!exam.solutionsOpen) return { state: "closed" as const, exam: head };

  const secs = parseSections(exam.sections);
  const letters = bookletLetters(bookletCount(exam));
  const booklet = result ? result.booklet || "A" : (letters as string[]).includes(bookletParam ?? "") ? bookletParam! : "A";
  const sections = await bookletOf(exam.ownerId, secs, booklet);

  let no = 0;
  let offset = 0;
  const out = sections.map((s, si) => {
    const sec = secs[si];
    const key = keyFor(sec, booklet);
    const questions: SolutionQuestion[] = [];
    s.questions.forEach((q, j) => {
      no++;
      if (!q) return;
      const base = { no, id: q.id, type: q.type, content: q.content, hasImage: q.hasImage, widthMm: q.widthMm, answer: answerLabel(q.type, q.answer), explanation: q.explanation };
      if (!result) return questions.push(base);
      const k = key[j];
      if (!k || k === " " || k === "?") return; // iptal / anahtarsız soru
      const a = result.answers[offset + j] ?? " ";
      if (a === k) return;
      questions.push({ ...base, given: a === " " ? "" : a === "*" ? "Çift" : q.type === "TF" ? (a === "A" ? "Doğru" : a === "B" ? "Yanlış" : a) : a });
    });
    offset += sec.count;
    return { name: s.name, questions };
  });

  return {
    state: "open" as const,
    exam: head,
    booklet,
    letters: result ? [] : letters,
    student: result ? `${result.student.firstName} ${result.student.lastName}` : null,
    sections: out.filter((s) => s.questions.length),
    total: no,
  };
}

export type Solutions = Awaited<ReturnType<typeof solutionsByToken>>;

/** Çözüm sayfasındaki kesilmiş sorunun görseli: anahtar geçerli, çözümler açık ve soru bu denemede olmalı. */
export async function solutionImage(token: string, itemId: string) {
  const found = await resolveToken(token);
  if (!found || !found.exam.solutionsOpen) throw notFound("Görsel bulunamadı.");
  const inExam = parseSections(found.exam.sections).some((s) => s.items?.includes(itemId));
  if (!inExam) throw notFound("Görsel bulunamadı.");
  return itemImage(found.exam.ownerId, itemId);
}
