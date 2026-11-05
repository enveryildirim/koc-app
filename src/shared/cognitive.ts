/**
 * Bilişsel düzey (Bloom taksonomisinin sadeleştirilmiş dört basamağı) — istemci + sunucu güvenli.
 * Soru havuzu ve denemeler birlikte kullanır; bu yüzden shared/ altındadır.
 * Not: arayüzde "Düzey" sınıf / sınav düzeyi (5–12, LGS…) anlamında kullanıldığı için bu alan
 * her yerde "Bilişsel düzey" diye adlandırılır.
 */
export const COGNITIVE_LEVELS = ["Bilgi", "Kavrama", "Uygulama", "Analiz"] as const;
export type CognitiveLevel = (typeof COGNITIVE_LEVELS)[number];

export const COGNITIVE_HINTS: Record<CognitiveLevel, string> = {
  Bilgi: "Hatırlama: tanım, kural, olgu",
  Kavrama: "Anlama ve yorumlama",
  Uygulama: "Bilgiyi yeni bir duruma uygulama, problem çözme",
  Analiz: "Çözümleme, ilişki kurma, akıl yürütme",
};

/** Serbest metni düzeye çevirir ("uyg", "ANALİZ" → "Uygulama", "Analiz"); tanınmazsa "". */
export function normalizeLevel(v: unknown): CognitiveLevel | "" {
  const s = String(v ?? "").trim().toLocaleLowerCase("tr-TR");
  if (s.length < 3) return "";
  return COGNITIVE_LEVELS.find((l) => l.toLocaleLowerCase("tr-TR").startsWith(s.slice(0, 3))) ?? "";
}
