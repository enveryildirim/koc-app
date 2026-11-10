/** Deneme sınavı → optik form tanımı ve cevap anahtarı (istemci + sunucu güvenli). */
import { choicesFor, ExamSection, keyFor, LETTERS } from "./domain";
import type { FormSpec } from "@/shared/omr/layout";

export type ExamKeyItem = { points: number; correct: number[]; number: number; section?: string };

/** letters: denemenin kitapçıkları (["A"] ise formda kitapçık alanı çıkmaz). */
/** studentNumber: false ise formda öğrenci numarası alanı basılmaz (Exam.omrStudentNo). */
export function examFormSpec(name: string, type: string, secs: ExamSection[], letters: readonly string[], opts: { studentNumber?: boolean; brand?: string } = {}): FormSpec {
  const c = choicesFor(type);
  return {
    title: name,
    brand: opts.brand ?? "SınavKur",
    ...(opts.studentNumber === false ? { studentNumber: false } : {}),
    booklets: letters.length > 1 ? [...letters] : undefined,
    sections: secs.map((s) => ({ name: s.name, count: s.count })),
    questions: secs.flatMap((s) => Array.from({ length: s.count }, () => ({ choiceCount: c }))),
  };
}

/** Her kitapçık için optik tarayıcının kullandığı anahtar. */
export function examKeys(secs: ExamSection[], letters: readonly string[]) {
  const build = (b: string): ExamKeyItem[] =>
    secs.flatMap((s) => {
      const key = keyFor(s, b);
      return Array.from({ length: s.count }, (_, i) => {
        const k = LETTERS.indexOf(key[i] ?? "");
        return { points: 1, correct: k >= 0 ? [k] : [], number: i + 1, section: s.name };
      });
    });
  return Object.fromEntries(letters.map((b) => [b, build(b)])) as { A: ExamKeyItem[] } & Record<string, ExamKeyItem[]>;
}
