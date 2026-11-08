/** Deneme konusu ↔ plan konusu eşleştirme (istemci + sunucu güvenli). */

/** Konu adında ayırt edici olmayan sözcükler. */
const STOP = new Set(["ve", "ile", "bir", "konu", "genel", "giriş", "temel", "kavramlar", "uygulamalar", "problemler"]);

const norm = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Sözcüklerin ilk 5 harfi (Türkçe ekleri kabaca atmak için): "olasılığı" → "olası".
 * Sayılar kısa da olsa ayırt edicidir ("sayfa 51–52" ≠ "sayfa 53–54", "deneme-1" ≠ "deneme-2").
 */
const stems = (s: string) =>
  norm(s)
    .split(" ")
    .filter((w) => /^\d+$/.test(w) || (w.length >= 3 && !STOP.has(w)))
    .map((w) => (/^\d+$/.test(w) ? String(Number(w)) : w.slice(0, 5)));

/**
 * İki konu adı aynı konuyu mu anlatıyor? Kısa olanın bütün kökleri uzun olanda geçiyorsa evet.
 * "Olasılık" ↔ "Basit Olayların Olma Olasılığı", "Paragraf" ↔ "Paragrafta Anlam" eşleşir;
 * "Sözcükte anlam" ↔ "Cümlede anlam" eşleşmez.
 */
export function topicMatches(a: string, b: string) {
  const x = stems(a);
  const y = stems(b);
  if (!x.length || !y.length) return norm(a) === norm(b);
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every((s) => long.includes(s));
}

/**
 * Deneme konusuna karşılık gelen plan konularının indeksleri. Önce birebir eşleşmeler aranır;
 * yoksa deneme konusunun her kökü plandaki konulardan birinde geçiyorsa o konuların hepsi döner
 * ("Yazım ve noktalama" → "Yazım Kuralları" + "Noktalama İşaretleri").
 */
export function matchPlanTopics(examTopic: string, planTopics: string[]) {
  const direct = planTopics.flatMap((p, i) => (topicMatches(examTopic, p) ? [i] : []));
  if (direct.length) return direct;
  const want = stems(examTopic);
  if (want.length < 2) return [];
  const hits = want.map((w) => planTopics.flatMap((p, i) => (stems(p).includes(w) ? [i] : [])));
  return hits.every((h) => h.length) ? [...new Set(hits.flat())] : [];
}
