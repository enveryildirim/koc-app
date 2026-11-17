/**
 * Soru benzerliği (saf hesap; veritabanı yok). Gerekçe ve ölçümler: notes/soru-benzerligi.md.
 *
 * İki ölçü:
 * - **Metin benzerliği** (TF-IDF + kosinüs, sayılar "#" ile maskeli): harf üçlüleri (Türkçe ekler kendiliğinden eşleşir),
 *   kısa adlar ve simgeler ("ab", "x", "⊥", "√", "²") ile simge dizileri ("[ ab ] ⊥ [ bc ]"). Formül ve şekil adları
 *   böylece metnin geri kalanı kadar ağırlık taşır. IDF havuzdan: çok soruda geçen kalıp ("en sade hali hangisidir") puanı şişirmez.
 *   Şıklar yarım ağırlıkla sayılır (aynı çeldiriciler farklı sorularda tekrar eder).
 * - **Sayı örtüşmesi** (sayı çoklukümelerinin Jaccard'ı).
 *
 * Etiket: metin çok benzer, sayılar ve doğru cevabın içeriği aynıysa "Aynı soru"; metin çok benzer ama sayılar ya da cevap
 * farklıysa "Benzer soru" ("… yer alır" / "… yer almaz" gibi olumsuz kök çiftleri, şıkları karıştırılmış kopyada harf değil içerik
 * karşılaştırılır).
 * Kullanıcıya puan değil etiket gösterilir. Eşikler (SIMILARITY) dev.db'deki sorularla ayarlandı; öğretmen kararları
 * biriktikçe yeniden bakılmalı.
 */

export type SimilarKind = "same" | "sibling";

export const SIMILAR_KINDS: Record<SimilarKind, { label: string; hint: string }> = {
  same: { label: "Aynı soru", hint: "Havuzdaki bir soruyla neredeyse aynı: aynen tekrar ya da birkaç kelimesi değişmiş" },
  sibling: { label: "Benzer soru", hint: "Aynı kalıp, başka sayılar: tekrar değil; aynı denemede birlikte olmasın" },
};

/** text: metin benzerliği eşiği (0–1); numbers: bu örtüşmeden itibaren sayılar "aynı" sayılır; top: soru başına en fazla sonuç. */
export const SIMILARITY = { text: 0.8, numbers: 0.6, top: 5 };

/** key: doğru cevabın içeriği (answerKey); bilinmiyorsa boş, o zaman cevap karşılaştırılmaz. */
export type SimDoc = { id: string; stem: string; options?: string[]; key?: string };
export type SimilarHit = { id: string; kind: SimilarKind; text: number; numbers: number };

type Vec = Map<string, number>;

/** Simgeler: harf, rakam, boşluk ve sıradan noktalama dışındaki her karakter tek başına bir simgedir. */
const TOKEN = /\p{L}+|\d+|[^\s\p{L}\d.,;:!?"'’‘`´…]/gu;

function tokens(s: string) {
  const k = s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/(\d)[.,](\d)/g, "$1$2");
  return k.match(TOKEN) ?? [];
}

const isNum = (t: string) => /^\d+$/.test(t);
const isWord = (t: string) => /^\p{L}+$/u.test(t);

/** Terim ağırlıkları (tf) ve sayılar. */
function features(d: SimDoc) {
  const tf = new Map<string, number>();
  const nums: string[] = [];
  const add = (t: string, w: number) => tf.set(t, (tf.get(t) ?? 0) + w);
  const part = (s: string, w: number) => {
    const ts = tokens(s).map((t) => (isNum(t) ? (nums.push(t), "#") : t));
    for (const t of ts) {
      if (isWord(t) && t.length >= 3) {
        const p = `_${t}_`;
        for (let i = 0; i + 3 <= p.length; i++) add(p.slice(i, i + 3), w);
      } else add(`t:${t}`, w);
    }
    // Simge dizileri: kelime dışı (sayı, simge, kısa ad) içeren ikililer formülün ve şeklin yapısını taşır
    for (let i = 0; i + 1 < ts.length; i++) {
      const a = ts[i];
      const b = ts[i + 1];
      if (!(isWord(a) && a.length >= 3 && isWord(b) && b.length >= 3)) add(`b:${a} ${b}`, w);
    }
    // Üçlüler yalnızca kelime içermeyen dizilerde: "ad ] ⊥" ile "dc ] ⊥" şeklin farklı kurulduğunu ayırır
    const prose = (t: string) => isWord(t) && t.length >= 3;
    for (let i = 0; i + 2 < ts.length; i++) if (!prose(ts[i]) && !prose(ts[i + 1]) && !prose(ts[i + 2])) add(`c:${ts[i]} ${ts[i + 1]} ${ts[i + 2]}`, w);
  };
  part(d.stem, 1);
  for (const o of d.options ?? []) part(o, 0.5);
  return { tf, nums, words: tokens(d.stem).length };
}

function vectorize(tfs: Map<string, number>[]) {
  const df = new Map<string, number>();
  for (const tf of tfs) for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const n = tfs.length;
  return tfs.map((tf) => {
    const v: Vec = new Map();
    let norm = 0;
    for (const [t, c] of tf) {
      const w = (1 + Math.log(1 + c)) * Math.log((n + 1) / ((df.get(t) ?? 0) + 0.5));
      if (w <= 0) continue;
      v.set(t, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [t, w] of v) v.set(t, w / norm);
    return v;
  });
}

function cosine(a: Vec, b: Vec) {
  const [s, l] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, w] of s) {
    const x = l.get(t);
    if (x) dot += w * x;
  }
  return dot;
}

/** Sayı çoklukümelerinin Jaccard'ı; ikisinde de sayı yoksa 1. */
function numberOverlap(a: string[], b: string[]) {
  if (!a.length && !b.length) return 1;
  const ca = new Map<string, number>();
  for (const x of a) ca.set(x, (ca.get(x) ?? 0) + 1);
  let inter = 0;
  for (const x of b) {
    const c = ca.get(x) ?? 0;
    if (c > 0) {
      inter++;
      ca.set(x, c - 1);
    }
  }
  return inter / (a.length + b.length - inter);
}

const round = (x: number) => Math.round(x * 100) / 100;

const norm = (s: string) => tokens(s).join(" ");

/**
 * Doğru cevabın içeriği (karşılaştırma için): çoktan seçmelide işaretli şıkkın metni, D/Y ve boşluk doldurmada cevap.
 * Açık uçluda boş (örnek cevaplar aynı soruda bile farklı yazılır).
 */
export function answerKey(type: string, answer: string, options?: string[]) {
  if (!answer) return "";
  if (type === "MC") {
    const i = "ABCDE".indexOf(answer.toUpperCase());
    return i >= 0 && options?.[i] ? norm(options[i]) : "";
  }
  return type === "OPEN" ? "" : norm(answer);
}

/**
 * Her sorgu sorusu için havuzdaki benzer sorular (kendisi hariç; önce "Aynı soru", sonra "Benzer soru", puana göre).
 * Sorgular havuzda yoksa IDF hesabına eklenir. Kısa metinler (4 simgeden az) etiketlenmez: rastgele eşleşir.
 * `all`: eşiğin altındakiler de döner (yalnızca ayar ölçümü için; kind o zaman en yakın etiket).
 */
export function findSimilar(queries: SimDoc[], pool: SimDoc[], opts: { top?: number; all?: boolean } = {}): Map<string, SimilarHit[]> {
  const inPool = new Set(pool.map((d) => d.id));
  const docs = [...pool, ...queries.filter((q) => !inPool.has(q.id))];
  const index = new Map(docs.map((d, i) => [d.id, i]));
  const f = docs.map(features);
  const vec = vectorize(f.map((x) => x.tf));
  const out = new Map<string, SimilarHit[]>();
  for (const q of queries) {
    const qi = index.get(q.id)!;
    const hits: SimilarHit[] = [];
    if (f[qi].words >= 4) {
      for (const p of pool) {
        const j = index.get(p.id)!;
        if (j === qi || f[j].words < 4) continue;
        const text = cosine(vec[qi], vec[j]);
        if (text < SIMILARITY.text && !opts.all) continue;
        const numbers = numberOverlap(f[qi].nums, f[j].nums);
        const sameAnswer = !q.key || !p.key || q.key === p.key;
        hits.push({ id: p.id, kind: numbers >= SIMILARITY.numbers && sameAnswer ? "same" : "sibling", text: round(text), numbers: round(numbers) });
      }
    }
    hits.sort((a, b) => (a.kind === b.kind ? b.text - a.text : a.kind === "same" ? -1 : 1));
    out.set(q.id, opts.all ? hits.sort((a, b) => b.text - a.text).slice(0, opts.top ?? SIMILARITY.top) : hits.slice(0, opts.top ?? SIMILARITY.top));
  }
  return out;
}
