/**
 * "Yapıştır ve böl": Word'den, PDF'ten ya da bir metinden yapıştırılan soruları ayrı sorulara böler (saf, yapay zekâsız).
 *
 * Tanınan düzen:
 *   1. Soru kökü (birden çok satır olabilir)        → numara ile yeni soru (1. 1) 1- Soru 1:)
 *   A) şık  B) şık   ya da her şık ayrı satırda    → çoktan seçmeli (A. a) A- de olur; *C) doğru şık)
 *   Cevap: C                                       → cevap satırı (Cvp, Yanıt, Doğru cevap)
 *   ( ) Yargı …  / cevap Doğru-Yanlış              → doğru / yanlış
 *   Kök içinde ___ ya da .....                     → boşluk doldurma
 *   Çözüm: … (Açıklama: …)                         → çözüm; sorunun sonuna kadar birden çok satır olabilir
 *   Cevap anahtarı: 1-C 2-A 3-D …                  → sondaki anahtar, numarayla eşleşir
 * Numara yoksa boş satırlar soruları ayırır.
 */
import { countBlanks, MAX_OPTIONS, normalizeAnswer, OPTION_LETTERS, splitFill, type QuestionType } from "./written";

export type DraftQuestion = {
  /** Kaynaktaki numara (varsa) */
  no: number | null;
  type: QuestionType;
  stem: string;
  options: string[];
  answer: string;
  /** "Çözüm:" satırından sonraki metin (yoksa boş) */
  explanation: string;
  warnings: string[];
};

const NUM_RE = /^\s*(?:soru\s*)?(\d{1,3})\s*[.)\-:–](?!\d)\s*(.*)$/i;
const ANSWER_RE = /^\s*(?:doğru\s+)?(?:cevap|cvp|yanıt|yanit)\s*[:=\-–]\s*(.+)$/i;
const EXPL_RE = /^\s*(?:çözüm|cozum|açıklama|aciklama)\s*[:=\-–]\s*(.*)$/iu;
const KEY_HEAD_RE = /^\s*(?:cevap\s+anahtar[ıi]|cevaplar|yan[ıi]tlar)(?![\p{L}])\s*:?\s*(.*)$/iu;
const KEY_PAIR_RE = /(\d{1,3})\s*[-.):=–]?\s*(doğru|yanlış|dogru|yanlis|[A-Ea-e]|[DdYy])(?![\p{L}])/gu;
const OPTION_LINE_RE = /^\s*(\*)?\s*([A-Ea-e])\s*[).:\-–]\s*(.*)$/;
const INLINE_OPT_RE = /(^|\s)(\*?)([A-E])\)\s*/g;
const TF_MARK_RE = /^\s*\(\s*(?:[DY]\s*\/\s*[DY]|D\s*\/\s*Y|\s*)\s*\)\s*|\s*\(\s*\)\s*$/i;

function normalize(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]/g, " ")
    .replace(/[​﻿]/g, "")
    .replace(/^\s*[•●▪◦]\s*/gm, "");
}

/** Satır şık listesi olarak bölünebiliyorsa (A) … B) … sıralı) şıklar; değilse null. */
function inlineOptions(line: string, expected: number): { text: string; star: boolean }[] | null {
  const hits = [...line.matchAll(INLINE_OPT_RE)];
  if (!hits.length || line.slice(0, hits[0].index! + hits[0][1].length).trim()) return null;
  if (hits.some((h, i) => OPTION_LETTERS.indexOf(h[3] as never) !== expected + i)) return null;
  if (hits.length < 2) return null;
  return hits.map((h, i) => {
    const start = h.index! + h[0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index! : line.length;
    return { text: line.slice(start, end).trim(), star: h[2] === "*" };
  });
}

/** Sondaki cevap anahtarını ayırır: "Cevap anahtarı" başlığı ya da yalnızca "1-C 2-A" çiftlerinden oluşan son satırlar. */
function takeKey(lines: string[]): { body: string[]; key: Map<number, string> } {
  const key = new Map<number, string>();
  const pairsOf = (s: string) => [...s.matchAll(KEY_PAIR_RE)];
  const onlyPairs = (s: string) => {
    const p = pairsOf(s);
    return p.length >= 2 && !s.replace(KEY_PAIR_RE, "").replace(/[\s,;|]/g, "");
  };
  let cut = lines.length;
  const head = lines.findIndex((l) => KEY_HEAD_RE.test(l));
  if (head >= 0) cut = head;
  else {
    let i = lines.length - 1;
    while (i >= 0 && !lines[i].trim()) i--;
    while (i >= 0 && onlyPairs(lines[i])) cut = i--;
  }
  for (const l of lines.slice(cut)) for (const m of pairsOf(l.replace(KEY_HEAD_RE, "$1"))) key.set(Number(m[1]), m[2]);
  return { body: lines.slice(0, cut), key };
}

/** Numaralı satırlara göre bloklar; numara sıralı artmalı (kök içindeki "3. kuvvet" gibi satırlar bölmesin). */
function blocks(lines: string[]): { no: number | null; lines: string[] }[] {
  const out: { no: number | null; lines: string[] }[] = [];
  let last: number | null = null;
  for (const l of lines) {
    const m = l.match(NUM_RE);
    const n = m ? Number(m[1]) : null;
    if (m && (last === null || n === last + 1)) {
      out.push({ no: n, lines: [m[2]] });
      last = n;
    } else if (out.length) out[out.length - 1].lines.push(l);
    else if (l.trim()) out.push({ no: null, lines: [l] });
  }
  if (last !== null) return out;
  // Numara yok: boş satırla ayrılmış bloklar; bloktaki her satır "( )" ile başlıyorsa her satır ayrı D/Y sorusu
  const paras = lines.join("\n").split(/\n\s*\n/).map((p) => p.split("\n")).filter((p) => p.some((l) => l.trim()));
  return paras.flatMap((p) => {
    const ls = p.filter((l) => l.trim());
    return ls.length > 1 && ls.every((l) => /^\s*\(\s*\)/.test(l)) ? ls.map((l) => ({ no: null, lines: [l] })) : [{ no: null, lines: p }];
  });
}

function parseBlock(no: number | null, lines: string[], keyAnswer: string | undefined): DraftQuestion {
  const stem: string[] = [];
  const options: string[] = [];
  let star = -1;
  let answerRaw = "";
  let expl: string[] | null = null;
  for (const l of lines) {
    const am = l.match(ANSWER_RE);
    if (am) {
      answerRaw = am[1].trim();
      continue;
    }
    const em = l.match(EXPL_RE);
    if (em) {
      expl = [em[1]];
      continue;
    }
    // Çözüm başladıysa sorunun geri kalanı çözümdür (şık ya da kök sayılmaz)
    if (expl) {
      expl.push(l);
      continue;
    }
    const inl = options.length < MAX_OPTIONS ? inlineOptions(l, options.length) : null;
    if (inl) {
      inl.forEach((o) => {
        if (o.star) star = options.length;
        options.push(o.text);
      });
      continue;
    }
    const om = l.match(OPTION_LINE_RE);
    if (om && OPTION_LETTERS.indexOf(om[2].toUpperCase() as never) === options.length && options.length < MAX_OPTIONS && (options.length || om[2] === "A" || om[2] === "a")) {
      if (om[1]) star = options.length;
      options.push(om[3].trim());
      continue;
    }
    if (options.length) {
      // Şıktan sonraki satır: son şıkkın devamı
      if (l.trim()) options[options.length - 1] = `${options[options.length - 1]} ${l.trim()}`.trim();
    } else stem.push(l);
  }

  let text = stem.join("\n").replace(/^\n+|\s+$/g, "");
  const raw = answerRaw || keyAnswer || "";
  const tfOptions = options.length === 2 && /^doğru$/i.test(options[0]) && /^yanlış$/i.test(options[1]);
  const tfMark = TF_MARK_RE.test(text);
  let type: QuestionType;
  if (options.length >= 2 && !tfOptions) type = "MC";
  else if (tfOptions || tfMark) type = "TF";
  else if (countBlanks(text)) type = "FILL";
  else if (!options.length && normalizeAnswer("TF", raw)) type = "TF";
  else type = "OPEN";
  if (type === "TF") text = text.replace(TF_MARK_RE, "").trim();

  let answer = "";
  if (type === "MC") answer = star >= 0 ? OPTION_LETTERS[star] : normalizeAnswer("MC", raw, options.length);
  else if (type === "TF") answer = tfOptions && /^[AB]$/i.test(raw) ? (raw.toUpperCase() === "A" ? "D" : "Y") : normalizeAnswer("TF", raw);
  else if (type === "FILL") answer = normalizeAnswer("FILL", raw.replace(/\s*[,;]\s*/g, "|"));
  else answer = normalizeAnswer("OPEN", raw);

  const warnings: string[] = [];
  if (!text) warnings.push("Soru kökü boş");
  if (type === "MC" && options.some((o) => !o)) warnings.push("Boş şık var");
  if (type === "MC" && !answer) warnings.push(raw ? `Cevap (${raw}) şıklarda yok` : "Cevap yok");
  if (type === "TF" && !answer) warnings.push("Doğru mu yanlış mı seçin");
  if (type === "FILL") {
    const n = countBlanks(text);
    const a = splitFill(answer).length;
    if (!answer) warnings.push("Boşluk cevabı yok");
    else if (a !== n) warnings.push(`${n} boşluk, ${a} cevap`);
  }
  const explanation = (expl ?? []).join("\n").trim();
  return { no, type, stem: text, options: type === "MC" ? options : [], answer, explanation, warnings };
}

/** Yapıştırılan metni sorulara böler. */
export function splitPasted(text: string): DraftQuestion[] {
  const { body, key } = takeKey(normalize(text).split("\n"));
  return blocks(body)
    // Numarasız sorularda anahtar sıra numarasıyla eşleşir
    .map((b, i) => parseBlock(b.no, b.lines, key.get(b.no ?? i + 1)))
    .filter((q) => q.stem || q.options.length);
}

/** "Örnek metinle dene" için: düzenin tamamını gösteren kısa örnek. */
export const PASTE_SAMPLE = `1. Aşağıdakilerden hangisi abdesti bozan durumlardan biridir?
A) Konuşmak  B) Uyumak  C) Gülümsemek  D) Su içmek
Cevap: B

2. 2x + 3 = 11 denkleminin çözümü kaçtır?
A) 2
B) 3
C) 4
D) 5
E) 6
Çözüm: 2x = 11 − 3 = 8, x = 4.

3. ( ) Kur'an-ı Kerim 114 sureden oluşur.
Cevap: Doğru

4. Günde beş vakit kılınan namazlardan ilki ___ namazıdır.
Cevap: sabah

5. Kitabet dersinde öğrendiğiniz harf gruplarını örneklerle açıklayınız.

Cevap anahtarı: 2-C`;
