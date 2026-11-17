/**
 * Soru türleri ve yazılan sorunun içeriği — saf kurallar (istemci + sunucu güvenli).
 * Kesilmiş soru: içerik görseldedir, `content` boştur, türü MC'dir.
 * Yazılan soru: `content` = { stem, options? }; görsel isteğe bağlı şekildir.
 */

export type QuestionType = "MC" | "TF" | "OPEN" | "FILL";

export const QUESTION_TYPES: Record<QuestionType, { label: string; short: string; optical: boolean; hint: string }> = {
  MC: { label: "Çoktan seçmeli", short: "Test", optical: true, hint: "Şıkları yazın, doğru şıkkın harfine tıklayın." },
  TF: { label: "Doğru / Yanlış", short: "D/Y", optical: true, hint: "Bir yargı yazın, doğru mu yanlış mı seçin." },
  FILL: { label: "Boşluk doldurma", short: "Boşluk", optical: false, hint: "Boşluk yerine ___ (üç alt çizgi) yazın; her boşluğun cevabını girin." },
  OPEN: { label: "Açık uçlu", short: "Klasik", optical: false, hint: "Soruyu yazın; isterseniz örnek cevap ya da puanlama notu ekleyin." },
};
export const TYPE_ORDER: QuestionType[] = ["MC", "TF", "FILL", "OPEN"];

export const isQuestionType = (v: unknown): v is QuestionType => typeof v === "string" && v in QUESTION_TYPES;
/** Optik formla okunabilen türler (sınav / denemeye girer); diğerleri yalnızca çalışma kağıdında. */
export const isOptical = (t: string) => isQuestionType(t) && QUESTION_TYPES[t].optical;

export const OPTION_LETTERS = ["A", "B", "C", "D", "E"] as const;
export const MAX_OPTIONS = 5;
export const TEXT_LIMITS = { stem: 4000, option: 500, answer: 2000, explanation: 4000, sourceNote: 200, agentNote: 1000 };

export type QuestionContent = { stem: string; options?: string[] };

/** Saklanan JSON'dan içerik; kesilmiş soruda (boş) ya da bozuk veride null. */
export function parseContent(raw: string | null | undefined): QuestionContent | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o.stem !== "string") return null;
    return { stem: o.stem, ...(Array.isArray(o.options) ? { options: o.options.map(String) } : {}) };
  } catch {
    return null;
  }
}

/**
 * Arama anahtarı: Türkçe küçük harf, şapka ve kesme işareti yok, ı = i, diğer noktalama boşluk.
 * "İlmihal" ↔ "ilmihal", "Kur'ân" ↔ "kuran", "Sıfât" ↔ "sifat" aynı sonucu verir. Saklanan alan ve aranan sözcük aynı işlemden geçer.
 */
export const searchKey = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’‘`´]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Arama için düz metin: kök + şıklar. */
export const plainText = (c: QuestionContent) => stripEmphasis([c.stem, ...(c.options ?? [])].join("\n")).trim();

/**
 * Vurgu: kökte ya da şıkta **…** arası kalın basılır (ör. olumsuz kök: "hangisi **değildir**?"). Yapay zekâ talimatı
 * olumsuz kökü böyle vurgulatır; öğretmen de elle yazabilir. Ekranda ve kitapçıkta QuestionView kalın yazar.
 */
export const EMPHASIS_RE = /\*\*(.+?)\*\*/g;
/** Vurgu işaretleri olmadan düz metin (başlık satırları, iletiler, arama, benzerlik). */
export const stripEmphasis = (s: string) => s.replace(EMPHASIS_RE, "$1");

/**
 * Satırın yazı yönü harf çoğunluğuna göre: Arapça harfi çoksa "rtl", değilse "ltr".
 * Tarayıcının dir="auto"su ilk harfe bakar; "بِسْمِ اللَّهِ yazınız…" gibi Türkçe ağırlıklı satırı yanlışlıkla sağa yaslardı.
 */
export function textDir(s: string): "rtl" | "ltr" {
  const rtl = (s.match(/[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/g) ?? []).length;
  const ltr = (s.match(/[A-Za-zÀ-ɏ]/g) ?? []).length;
  return rtl > ltr ? "rtl" : "ltr";
}

/** Boşluk işaretleri: üç ve daha fazla alt çizgi, dört ve daha fazla nokta ya da iki ve daha fazla üç nokta. */
export const BLANK_RE = /_{3,}|\.{4,}|…{2,}/g;
export const countBlanks = (stem: string) => (stem.match(BLANK_RE) ?? []).length;

export const FILL_SEP = " | ";
export const splitFill = (answer: string) => (answer ? answer.split("|").map((s) => s.trim()) : []);

const TRUE_WORDS = ["d", "doğru", "dogru", "t", "true", "evet"];
const FALSE_WORDS = ["y", "yanlış", "yanlis", "f", "false", "hayır", "hayir"];

/**
 * Türe göre cevabı saklanan biçime çevirir; geçersizse "".
 * MC: "A"–"E" (şık sayısı verilirse onunla sınırlı) · TF: "D" | "Y" · FILL: boşluk cevapları " | " ile · OPEN: serbest metin.
 */
export function normalizeAnswer(type: QuestionType, v: unknown, optionCount?: number): string {
  const raw = Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).join(FILL_SEP) : String(v ?? "").trim();
  if (!raw) return "";
  if (type === "MC") {
    const a = raw.slice(0, 1).toUpperCase();
    const i = (OPTION_LETTERS as readonly string[]).indexOf(a);
    return raw.length === 1 && i >= 0 && (!optionCount || i < optionCount) ? a : "";
  }
  if (type === "TF") {
    const w = raw.toLocaleLowerCase("tr-TR").replace(/[().]/g, "").trim();
    return TRUE_WORDS.includes(w) ? "D" : FALSE_WORDS.includes(w) ? "Y" : "";
  }
  if (type === "FILL") {
    const parts = raw.split("|").map((s) => s.trim());
    return parts.some(Boolean) ? parts.join(FILL_SEP).slice(0, TEXT_LIMITS.answer) : "";
  }
  return raw.slice(0, TEXT_LIMITS.answer);
}

/** Cevabın okunur hâli (liste ve anahtar sayfası için). */
export function answerLabel(type: string, answer: string) {
  if (!answer) return "";
  if (type === "TF") return answer === "D" ? "Doğru" : answer === "Y" ? "Yanlış" : answer;
  if (type === "FILL") return splitFill(answer).join(" · ");
  return answer;
}

/** Optik formdaki harf: MC cevabın kendisi, D/Y'de A = Doğru, B = Yanlış. Optikle okunmayan türde "". */
export function opticalLetter(type: string, answer: string) {
  if (type === "TF") return answer === "D" ? "A" : answer === "Y" ? "B" : "";
  if (type === "MC" || !type) return answer;
  return "";
}

/** Bu türde cevap zorunlu mu (OPEN'da örnek cevap isteğe bağlıdır). */
export const needsAnswer = (type: string) => type !== "OPEN";
