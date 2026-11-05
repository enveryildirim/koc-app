/**
 * Madde (soru) analizi — saf hesap (istemci + sunucu güvenli).
 * Bütün kitapçıklar `orderFor()` eşlemesiyle A sırasına çevrilir; kitapçıklarda yalnızca soru sırası
 * karıştığı için şıklar aynıdır ve dağılımlar doğrudan birleştirilebilir.
 *
 * Ayırt edicilik (D): bölüm doğru sayısına göre en yüksek %27'lik grubun doğru oranı eksi en düşük
 * %27'lik grubun doğru oranı. Ölçüt bölüm puanıdır; bir Türkçe sorusu Türkçe başarısıyla karşılaştırılır.
 * Grup sınırındaki eşitlikler önce bütün sınavdaki doğru sayısına, sonra cevap dizisine göre çözülür;
 * böylece sonuç, sonuçların listelenme sırasına bağlı değildir.
 */
import { keyFor, LETTERS, orderFor, type ExamSection } from "./domain";

export const ITEM_RULES = {
  /** Üst / alt grup oranı. */
  groupShare: 0.27,
  /** Bu katılımcı sayısının altında ayırt edicilik "az veri" olarak işaretlenir. */
  minN: 20,
  /** Güçlük: doğru oranı bu değerin altındaysa "çok zor", üstündeyse "çok kolay". */
  hard: 30,
  easy: 85,
};

/** Ebel'in ayırt edicilik sınıflaması. */
export function discriminationLabel(d: number) {
  if (d >= 0.4) return { label: "Çok iyi", cls: "text-emerald-700" };
  if (d >= 0.3) return { label: "İyi", cls: "text-emerald-700" };
  if (d >= 0.2) return { label: "Düzeltilebilir", cls: "text-amber-700" };
  return { label: "Zayıf", cls: "text-red-700" };
}

export type ItemFlag = "KEY" | "LOW_D" | "NEGATIVE_D";
export const ITEM_FLAGS: Record<ItemFlag, string> = {
  KEY: "Anahtar hatası olabilir",
  NEGATIVE_D: "Başarılı öğrenciler daha çok yanlış yapmış",
  LOW_D: "Ayırt ediciliği düşük",
};

export type ItemStat = {
  section: string;
  /** A kitapçığındaki soru numarası (1 tabanlı). */
  q: number;
  key: string;
  topic: string;
  /** Bilişsel düzey; girilmemişse "". */
  level: string;
  /** Hesaba giren cevap sayısı. */
  n: number;
  /** Güçlük: doğru oranı (%). */
  p: number;
  /** Şık ve boş oranları (%); çift işaretleme ayrı. */
  choices: Record<string, number>;
  blank: number;
  double: number;
  /** Ayırt edicilik (−1…1); katılımcı 2'nin altındaysa null. */
  d: number | null;
  /** Üst grupta en çok seçilen yanlış şık ve oranı (%). */
  topDistractor: { letter: string; pct: number; upperPct: number } | null;
  flag: ItemFlag | null;
};

export type ItemAnalysis = {
  items: ItemStat[];
  /** Eşlemesi olmadığı için analize katılamayan sonuçlar (kitapçık → bölüm sayısı başına öğrenci). */
  skipped: { booklet: string; section: string; count: number }[];
};

const pct = (x: number, n: number) => (n ? Math.round((x * 100) / n) : 0);

export function itemAnalysis(sections: ExamSection[], results: { answers: string; booklet: string }[], choiceCount: number): ItemAnalysis {
  const letters = LETTERS.slice(0, choiceCount).split("");
  // Eşitlik bozucu: her sonucun bütün sınavdaki doğru sayısı
  const overall = results.map((r) => {
    let off = 0;
    let n = 0;
    for (const s of sections) {
      const key = keyFor(s, r.booklet || "A");
      for (let j = 0; j < s.count; j++) if (key[j] && r.answers[off + j] === key[j]) n++;
      off += s.count;
    }
    return n;
  });
  const items: ItemStat[] = [];
  const skipped: ItemAnalysis["skipped"] = [];
  let offset = 0;

  for (const s of sections) {
    const start = offset;
    offset += s.count;
    // Her sonucun bu bölümdeki cevapları, A sırasına çevrilmiş olarak; ve bölüm doğru sayısı
    const rows: { a: string[]; correct: boolean[]; total: number; overall: number; answers: string }[] = [];
    const skip = new Map<string, number>();
    for (const [ri, r] of results.entries()) {
      const booklet = r.booklet || "A";
      const order = orderFor(s, booklet);
      if (!order) {
        skip.set(booklet, (skip.get(booklet) ?? 0) + 1);
        continue;
      }
      const key = keyFor(s, booklet);
      const a = new Array<string>(s.count).fill(" ");
      const correct = new Array<boolean>(s.count).fill(false);
      let total = 0;
      for (let j = 0; j < s.count; j++) {
        const ans = r.answers[start + j] ?? " ";
        a[order[j]] = ans;
        if (key[j] && ans === key[j]) {
          correct[order[j]] = true;
          total++;
        }
      }
      rows.push({ a, correct, total, overall: overall[ri], answers: r.answers });
    }
    for (const [booklet, count] of skip) skipped.push({ booklet, section: s.name, count });

    const sorted = [...rows].sort(
      (x, y) => y.total - x.total || y.overall - x.overall || (x.answers < y.answers ? -1 : x.answers > y.answers ? 1 : 0),
    );
    const g = rows.length >= 2 ? Math.max(1, Math.round(rows.length * ITEM_RULES.groupShare)) : 0;
    const upper = sorted.slice(0, g);
    const lower = g ? sorted.slice(-g) : [];

    for (let i = 0; i < s.count; i++) {
      const key = s.keyA[i] ?? "";
      const n = rows.length;
      const count = (list: typeof rows, ch: string) => list.filter((r) => r.a[i] === ch).length;
      const choices = Object.fromEntries(letters.map((l) => [l, pct(count(rows, l), n)]));
      const p = pct(rows.filter((r) => r.correct[i]).length, n);
      const rate = (list: typeof rows) => (list.length ? list.filter((r) => r.correct[i]).length / list.length : 0);
      const d = g ? Math.round((rate(upper) - rate(lower)) * 100) / 100 : null;

      let topDistractor: ItemStat["topDistractor"] = null;
      for (const l of letters) {
        if (l === key) continue;
        const up = pct(count(upper, l), upper.length);
        if (!topDistractor || up > topDistractor.upperPct || (up === topDistractor.upperPct && choices[l] > topDistractor.pct)) {
          topDistractor = { letter: l, pct: choices[l], upperPct: up };
        }
      }
      const upperKey = pct(count(upper, key), upper.length);

      let flag: ItemFlag | null = null;
      if (key && g && topDistractor && topDistractor.upperPct > upperKey && topDistractor.upperPct >= 30) flag = "KEY";
      else if (d !== null && d < 0) flag = "NEGATIVE_D";
      else if (d !== null && d < 0.2 && n >= ITEM_RULES.minN) flag = "LOW_D";

      items.push({
        section: s.name,
        q: i + 1,
        key,
        topic: s.topics?.[i] ?? "",
        level: s.levels?.[i] ?? "",
        n,
        p,
        choices,
        blank: pct(count(rows, " "), n),
        double: pct(count(rows, "*"), n),
        d,
        topDistractor,
        flag,
      });
    }
  }
  return { items, skipped };
}
