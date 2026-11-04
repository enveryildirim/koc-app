/** Deneme sınavı → optik form tanımı ve cevap anahtarı (istemci + sunucu güvenli). */
import { choicesFor, ExamSection, LETTERS } from "./exam";
import type { FormSpec } from "./omr/layout";

export type ExamKeyItem = { points: number; correct: number[]; number: number; section?: string };

export function examFormSpec(name: string, type: string, secs: ExamSection[], booklet: boolean, brand = "SınavKur"): FormSpec {
  const c = choicesFor(type);
  return {
    title: name,
    brand,
    booklet,
    sections: secs.map((s) => ({ name: s.name, count: s.count })),
    questions: secs.flatMap((s) => Array.from({ length: s.count }, () => ({ choiceCount: c }))),
  };
}

export function examKeys(secs: ExamSection[]) {
  const build = (b: "A" | "B"): ExamKeyItem[] =>
    secs.flatMap((s) => {
      const key = b === "B" ? s.keyB || s.keyA : s.keyA;
      return Array.from({ length: s.count }, (_, i) => {
        const k = LETTERS.indexOf(key[i] ?? "");
        return { points: 1, correct: k >= 0 ? [k] : [], number: i + 1, section: s.name };
      });
    });
  return { A: build("A"), B: build("B") };
}
