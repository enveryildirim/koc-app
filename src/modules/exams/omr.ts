/** Deneme sınavı → optik form tanımı ve cevap anahtarı (istemci + sunucu güvenli). */
import { choicesFor, ExamSection, keyFor, LETTERS } from "./domain";
import type { FormSpec } from "@/shared/omr/layout";

export type ExamKeyItem = { points: number; correct: number[]; number: number; section?: string };

/** letters: denemenin kitapçıkları (["A"] ise formda kitapçık alanı çıkmaz). */
export function examFormSpec(name: string, type: string, secs: ExamSection[], letters: readonly string[], brand = "SınavKur"): FormSpec {
  const c = choicesFor(type);
  return {
    title: name,
    brand,
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
