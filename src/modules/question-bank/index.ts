/** question-bank — soru havuzu: kaynaktan soru kesme, etiketleme (istemci + sunucu güvenli). */
export * from "./types";
export { detectQuestions, type DetectOptions } from "./detect";

export const DIFFICULTY: Record<number, string> = { 1: "Kolay", 2: "Orta", 3: "Zor" };
export const ANSWERS = ["A", "B", "C", "D", "E"] as const;
export const GRADES = ["5", "6", "7", "8", "9", "10", "11", "12", "LGS", "TYT", "AYT"];

/** Ders alanı için öneriler; kurumun kullandığı dersler bunlara eklenir. */
export const DEFAULT_SUBJECTS = [
  "Türkçe",
  "Matematik",
  "Geometri",
  "Fen Bilimleri",
  "Fizik",
  "Kimya",
  "Biyoloji",
  "Sosyal Bilgiler",
  "Tarih",
  "Coğrafya",
  "Felsefe",
  "T.C. İnkılap Tarihi",
  "Din Kültürü",
  "İngilizce",
];

/** Tek seferde kaydedilebilecek soru sayısı ve dosya sınırları (sunucu da denetler). */
export const LIMITS = { batch: 60, sourceMB: 40, imageMB: 15, cropMB: 5 };
