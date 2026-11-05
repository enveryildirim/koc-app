/** Deneme sınavı (LGS / TYT / AYT / serbest) alan mantığı: şablonlar, net hesabı. */
import { COGNITIVE_LEVELS, normalizeLevel } from "@/shared/cognitive";

export type ExamSection = {
  name: string;
  count: number;
  keyA: string;
  keyB: string;
  /** C ve D kitapçıklarının anahtarları (4 kitapçığa kadar). Erişim: keyFor() */
  keyC?: string;
  keyD?: string;
  /** A kitapçığı soru sırasıyla konu (kazanım) adları; boş string = konu girilmemiş */
  topics?: string[];
  /** A kitapçığı sırasıyla bilişsel düzey (shared/cognitive.ts); boş string = girilmemiş */
  levels?: string[];
  /** B kitapçığı eşlemesi: bOrder[j] = B'deki j. sorunun A'daki indeksi (0 tabanlı) */
  bOrder?: number[];
  /** C / D kitapçığı eşlemeleri (bOrder ile aynı anlamda). Erişim: orderFor() */
  cOrder?: number[];
  dOrder?: number[];
  /** Soru havuzundan kurulduysa A kitapçığı sırasıyla soru kimlikleri (QuestionItem.id) */
  items?: string[];
};

export type Scoring = { base: number; coefs: number[] };
export type SectionStat = { d: number; y: number; b: number; net: number };

export const EXAM_TYPES: Record<
  string,
  { label: string; choices: number; wrongPer: number; sections: { name: string; count: number }[] }
> = {
  LGS: {
    label: "LGS",
    choices: 4,
    wrongPer: 3,
    sections: [
      { name: "Türkçe", count: 20 },
      { name: "Matematik", count: 20 },
      { name: "Fen Bilimleri", count: 20 },
      { name: "T.C. İnkılap Tarihi", count: 10 },
      { name: "Din Kültürü", count: 10 },
      { name: "İngilizce", count: 10 },
    ],
  },
  TYT: {
    label: "TYT",
    choices: 5,
    wrongPer: 4,
    sections: [
      { name: "Türkçe", count: 40 },
      { name: "Sosyal Bilimler", count: 20 },
      { name: "Temel Matematik", count: 40 },
      { name: "Fen Bilimleri", count: 20 },
    ],
  },
  AYT: {
    label: "AYT (Sayısal)",
    choices: 5,
    wrongPer: 4,
    sections: [
      { name: "Matematik", count: 40 },
      { name: "Fizik", count: 14 },
      { name: "Kimya", count: 13 },
      { name: "Biyoloji", count: 13 },
    ],
  },
  SERBEST: {
    label: "Serbest",
    choices: 5,
    wrongPer: 4,
    sections: [{ name: "Genel", count: 20 }],
  },
};

/** Tahmini puan için varsayılan taban puan ve ders katsayıları (bölüm adına göre). Yaklaşık değerlerdir. */
const DEFAULT_SCORING: Record<string, { base: number; coefs: Record<string, number> }> = {
  LGS: {
    base: 194.752,
    coefs: { "Türkçe": 4.348, "Matematik": 4.256, "Fen Bilimleri": 4.124, "T.C. İnkılap Tarihi": 1.666, "Din Kültürü": 1.899, "İngilizce": 1.5075 },
  },
  TYT: { base: 100, coefs: { "Türkçe": 3.3, "Sosyal Bilimler": 3.4, "Temel Matematik": 3.3, "Fen Bilimleri": 3.4 } },
  AYT: { base: 100, coefs: { "Matematik": 5, "Fizik": 5, "Kimya": 5, "Biyoloji": 5 } },
};

/** Sınav için geçerli puan ayarı: kayıtlı ayar varsa o, yoksa türün varsayılanı; bilinmeyen bölümler için 100 üzerinden eşit ağırlık. */
export function resolveScoring(type: string, sections: { name: string; count: number }[], stored?: string | Scoring | null): Scoring {
  let s: Scoring | null = null;
  if (stored && typeof stored === "object") s = stored;
  else if (stored) {
    try {
      s = JSON.parse(stored);
    } catch {}
  }
  if (s && Array.isArray(s.coefs) && s.coefs.length === sections.length) return s;
  const d = DEFAULT_SCORING[type];
  const total = sections.reduce((a, x) => a + x.count, 0) || 1;
  if (d && sections.every((x) => d.coefs[x.name] !== undefined)) {
    return { base: d.base, coefs: sections.map((x) => d.coefs[x.name]) };
  }
  // Serbest / özelleştirilmiş: 100 üzerinden, soru başına eşit
  return { base: 0, coefs: sections.map(() => round2(100 / total * 1000) / 1000) };
}

export function computeScore(stats: SectionStat[], scoring: Scoring) {
  const raw = scoring.base + stats.reduce((a, st, i) => a + Math.max(0, st.net) * (scoring.coefs[i] ?? 0), 0);
  return round2(raw);
}

export function maxScore(sections: { count: number }[], scoring: Scoring) {
  return round2(scoring.base + sections.reduce((a, s, i) => a + s.count * (scoring.coefs[i] ?? 0), 0));
}

export const LETTERS = "ABCDE";

export function choicesFor(type: string) {
  return EXAM_TYPES[type]?.choices ?? 5;
}

export function parseSections(json: string): ExamSection[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export function totalQuestions(sections: ExamSection[]) {
  return sections.reduce((s, x) => s + x.count, 0);
}

/** Cevap dizisini bölümlere göre puanlar. answers: harf | " " (boş) | "*" (çift işaret = yanlış). */
export function gradeExam(sections: ExamSection[], answers: string, booklet: string, wrongPer: number, scoring?: Scoring) {
  let offset = 0;
  const stats: SectionStat[] = sections.map((s) => {
    const key = keyFor(s, booklet).toUpperCase();
    let d = 0;
    let y = 0;
    let b = 0;
    for (let i = 0; i < s.count; i++) {
      const a = (answers[offset + i] ?? " ").toUpperCase();
      const k = key[i] ?? "";
      if (a === " " || a === "") b++;
      else if (a === k) d++;
      else y++;
    }
    offset += s.count;
    const net = round2(wrongPer > 0 ? d - y / wrongPer : d);
    return { d, y, b, net };
  });
  const totalNet = round2(stats.reduce((s, x) => s + x.net, 0));
  const score = scoring ? computeScore(stats, scoring) : 0;
  return { stats, totalNet, score };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Öğrenci numaralarını karşılaştırmak için baştaki sıfırları atar (kural enrollment modülünde). */
export { normStudentNo as normNo } from "@/modules/enrollment";

/** Deterministik karıştırma permütasyonu: perm[j] = B'deki j. sorunun A'daki indeksi. */
export function shufflePerm(count: number, seed: number) {
  const arr = Array.from({ length: count }, (_, i) => i);
  let x = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    x = (x * 9301 + 49297) % 233280;
    const j = Math.floor((x / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** A anahtarından, soruları karıştırılmış bir kitapçığın (B, C, D) anahtarı ve eşlemesi: order[j] = j. sorunun A'daki indeksi. */
export function makeBooklet(keyA: string, seed: number) {
  const order = shufflePerm(keyA.length, seed);
  return { key: order.map((i) => keyA[i]).join(""), order };
}

/* ------------------------------- Kitapçıklar ------------------------------- */

export const BOOKLETS = ["A", "B", "C", "D"] as const;
export type Booklet = (typeof BOOKLETS)[number];
/** A dışındaki kitapçıklar (anahtar ve eşleme tutanlar). */
export type AltBooklet = Exclude<Booklet, "A">;

/** Bölümde A dışındaki kitapçıkların alan adları (düzenleme ekranı için). */
export const KEY_FIELD = { B: "keyB", C: "keyC", D: "keyD" } as const;
export const ORDER_FIELD = { B: "bOrder", C: "cOrder", D: "dOrder" } as const;

export const isBooklet = (x: unknown): x is Booklet => typeof x === "string" && (BOOKLETS as readonly string[]).includes(x);

/** Denemenin kitapçık sayısı (1–4). bookletB false ise tek kitapçık; eski kayıtlarda booklets yoksa 2. */
export function bookletCount(e: { bookletB: boolean; booklets?: number | null }) {
  return e.bookletB ? Math.min(4, Math.max(2, e.booklets ?? 2)) : 1;
}

/** Kullanılan kitapçık harfleri: ["A"], ["A","B"], … */
export function bookletLetters(n: number): Booklet[] {
  return BOOKLETS.slice(0, Math.min(4, Math.max(1, n)));
}

/** Kitapçığın cevap anahtarı. Girilmemişse A anahtarı (deneme "anahtarı eksik" sayılır). */
export function keyFor(s: ExamSection, booklet: string): string {
  if (booklet === "A" || !isBooklet(booklet)) return s.keyA;
  return s[KEY_FIELD[booklet as AltBooklet]] || s.keyA;
}

/** Kitapçığın A'ya eşlemesi (order[j] = j. sorunun A'daki indeksi). A için birim sıra; girilmemişse undefined. */
export function orderFor(s: ExamSection, booklet: string): number[] | undefined {
  if (booklet === "A") return Array.from({ length: s.count }, (_, i) => i);
  if (!isBooklet(booklet)) return undefined;
  const o = s[ORDER_FIELD[booklet as AltBooklet]];
  return o && o.length === s.count ? o : undefined;
}

/** Bölüme bir kitapçığın anahtarını / eşlemesini yazar (yeni nesne). */
export function setBooklet(s: ExamSection, booklet: AltBooklet, key: string, order?: number[]): ExamSection {
  const out: ExamSection = { ...s, [KEY_FIELD[booklet]]: key };
  if (order) out[ORDER_FIELD[booklet]] = order;
  else delete out[ORDER_FIELD[booklet]];
  return out;
}

/** Bölümden kullanılmayan kitapçıkların (n'den sonrakiler) alanlarını atar. */
export function trimBooklets(s: ExamSection, n: number): ExamSection {
  const out: ExamSection = { ...s };
  for (const b of ["B", "C", "D"] as const) {
    if (bookletLetters(n).includes(b)) continue;
    if (b === "B") out.keyB = "";
    else delete out[KEY_FIELD[b]];
    delete out[ORDER_FIELD[b]];
  }
  return out;
}

/** Tüm kitapçıkların anahtarları tam mı. */
export function sectionsKeyed(secs: ExamSection[], n: number) {
  return secs.every((s) => bookletLetters(n).every((b) => (b === "A" ? s.keyA : (s[KEY_FIELD[b as AltBooklet]] ?? "")).length === s.count));
}

/** B kitapçığı için A anahtarının karıştırılmış hâli (test verisi ve "otomatik üret" için). */
export function shuffleKey(key: string, seed: number) {
  const arr = key.split("");
  let x = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    x = (x * 9301 + 49297) % 233280;
    const j = Math.floor((x / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

export function randomKey(count: number, choices: number) {
  return Array.from({ length: count }, () => LETTERS[Math.floor(Math.random() * choices)]).join("");
}

export const fmtNet = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

/* ------------------------------- Konu (kazanım) ------------------------------- */

/** "1-5: Üslü ifadeler" biçimindeki satırları soru başına konu dizisine çevirir. */
export function parseTopicSpec(text: string, count: number): { topics: string[]; errors: string[] } {
  const topics = Array.from({ length: count }, () => "");
  const errors: string[] = [];
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, li) => {
      const m = line.match(/^(\d+)\s*(?:[-–]\s*(\d+))?\s*[:.)]\s*(.+)$/);
      if (!m) return errors.push(`Satır ${li + 1}: "1-5: Konu adı" biçiminde olmalı`);
      const a = Number(m[1]);
      const b = Number(m[2] ?? m[1]);
      if (a < 1 || b > count || a > b) return errors.push(`Satır ${li + 1}: soru aralığı 1–${count} içinde olmalı`);
      for (let i = a; i <= b; i++) topics[i - 1] = m[3].trim();
    });
  return { topics, errors };
}

/** Konu dizisini aralıklı metne çevirir ("1-5: Konu"). */
export function formatTopicSpec(topics: string[] = []) {
  const lines: string[] = [];
  let i = 0;
  while (i < topics.length) {
    if (!topics[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < topics.length && topics[j + 1] === topics[i]) j++;
    lines.push(`${i + 1}${j > i ? `-${j + 1}` : ""}: ${topics[i]}`);
    i = j + 1;
  }
  return lines.join("\n");
}

export type TopicStat = { section: string; topic: string; questions: number; correct: number; total: number; rate: number };

/**
 * Bir veya daha çok sonuç için konu bazında doğru oranları.
 * A dışındaki kitapçıkta eşleme (bOrder / cOrder / dOrder) yoksa o bölümün o kitapçıklı cevapları hesaba katılmaz.
 */
export function topicStats(sections: ExamSection[], results: { answers: string; booklet: string }[]): TopicStat[] {
  const map = new Map<string, TopicStat>();
  let offset = 0;
  for (const s of sections) {
    const start = offset;
    offset += s.count;
    if (!s.topics?.some(Boolean)) continue;
    // konu başına soru sayısı (A sırası)
    s.topics.forEach((t) => {
      if (!t) return;
      const k = s.name + "|" + t;
      if (!map.has(k)) map.set(k, { section: s.name, topic: t, questions: 0, correct: 0, total: 0, rate: 0 });
      map.get(k)!.questions++;
    });
    for (const r of results) {
      const order = orderFor(s, r.booklet || "A");
      if (!order) continue;
      const key = keyFor(s, r.booklet || "A");
      for (let j = 0; j < s.count; j++) {
        const aIdx = order[j];
        const t = s.topics[aIdx];
        if (!t) continue;
        const st = map.get(s.name + "|" + t)!;
        st.total++;
        if ((r.answers[start + j] ?? " ") === key[j]) st.correct++;
      }
    }
  }
  return [...map.values()].map((x) => ({ ...x, rate: x.total ? Math.round((x.correct / x.total) * 100) : 0 }));
}

/* ------------------------------- Bilişsel düzey ------------------------------- */

/** "1-5: Uygulama" satırlarını soru başına düzey dizisine çevirir; düzey adları kısaltılabilir ("uyg"). */
export function parseLevelSpec(text: string, count: number): { levels: string[]; errors: string[] } {
  const { topics, errors } = parseTopicSpec(text, count);
  const bad = [...new Set(topics.filter((t) => t && !normalizeLevel(t)))];
  if (bad.length) errors.push(`"${bad[0]}" tanınmadı; ${COGNITIVE_LEVELS.join(", ")} yazın`);
  return { levels: topics.map((t) => normalizeLevel(t)), errors };
}

export type LevelStat = { level: string; questions: number; correct: number; total: number; rate: number };

/**
 * Bilişsel düzeye göre doğru oranları (bütün bölümler birlikte, COGNITIVE_LEVELS sırasıyla).
 * Eşlemesi olmayan kitapçığın cevapları, konu analizinde olduğu gibi o bölümde hesaba katılmaz.
 */
export function levelStats(sections: ExamSection[], results: { answers: string; booklet: string }[]): LevelStat[] {
  const map = new Map<string, LevelStat>(COGNITIVE_LEVELS.map((l) => [l, { level: l, questions: 0, correct: 0, total: 0, rate: 0 }]));
  let offset = 0;
  for (const s of sections) {
    const start = offset;
    offset += s.count;
    if (!s.levels?.some(Boolean)) continue;
    s.levels.forEach((l) => l && map.get(l) && map.get(l)!.questions++);
    for (const r of results) {
      const order = orderFor(s, r.booklet || "A");
      if (!order) continue;
      const key = keyFor(s, r.booklet || "A");
      for (let j = 0; j < s.count; j++) {
        const st = map.get(s.levels[order[j]] ?? "");
        if (!st) continue;
        st.total++;
        if ((r.answers[start + j] ?? " ") === key[j]) st.correct++;
      }
    }
  }
  return [...map.values()].filter((x) => x.questions).map((x) => ({ ...x, rate: x.total ? Math.round((x.correct * 100) / x.total) : 0 }));
}
