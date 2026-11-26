/** question-bank — soru havuzu: kaynaktan soru kesme, etiketleme (istemci + sunucu güvenli). */
export * from "./types";
export { detectQuestions, type DetectOptions } from "./detect";
export * from "./written";
export { SIMILAR_KINDS, SIMILARITY, findSimilar, type SimilarKind, type SimilarHit, type SimDoc } from "./similarity";
export { splitPasted, PASTE_SAMPLE, type DraftQuestion } from "./paste";

export const DIFFICULTY: Record<number, string> = { 1: "Kolay", 2: "Orta", 3: "Zor" };
export const ANSWERS = ["A", "B", "C", "D", "E"] as const;
// Ders ve sınıf / seviye için sabit liste yok: seçenekler kurumun girdiklerinden gelir (Dersler, Sınıflar, Müfredat, havuz).

/** Tek seferde kaydedilebilecek soru sayısı ve dosya sınırları (sunucu da denetler). */
export const LIMITS = { batch: 60, sourceMB: 40, imageMB: 15, cropMB: 5 };
