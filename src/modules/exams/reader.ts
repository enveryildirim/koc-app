/**
 * Optik okuyucu (FMT) TXT biçimi: sabit sütunlu satırlarda alanların yeri (1'den başlayan sütun).
 * Biçim sınavda saklanır (`Exam.readerFormat`); her bölümün cevapları ayrı bir sütundan başlayabilir
 * (okuyucular genellikle her derse sabit bir blok ayırır). İstemci + sunucu güvenli, saf fonksiyonlar.
 */
import { LETTERS } from "./domain";

export type ReaderFormat = {
  nameStart: number;
  nameLen: number;
  noStart: number;
  noLen: number;
  /** 0 = dosyada kitapçık yok */
  bookletStart: number;
  /** Her bölümün ilk cevabının sütunu (bölüm sırasıyla) */
  sectionStarts: number[];
};

type Sec = { name: string; count: number };

/** Varsayılan: ad 1–25, no 26–31, kitapçık 32, cevaplar 33'ten bitişik. */
export function defaultReaderFormat(sections: Sec[]): ReaderFormat {
  return { nameStart: 1, nameLen: 25, noStart: 26, noLen: 6, bookletStart: 32, sectionStarts: contiguous(33, sections) };
}

/** İlk bölüm `start`'tan başlar, diğerleri arka arkaya. */
export function contiguous(start: number, sections: Sec[]) {
  let at = start;
  return sections.map((s) => {
    const x = at;
    at += s.count;
    return x;
  });
}

/** Saklanan biçimi çözer; bölüm sayısı uymuyorsa (sınav değiştiyse) eksik bölümler öncekinin arkasına eklenir. */
export function parseReaderFormat(json: string, sections: Sec[]): ReaderFormat {
  const d = defaultReaderFormat(sections);
  if (!json) return d;
  try {
    const v = JSON.parse(json) as Partial<ReaderFormat>;
    const starts = Array.isArray(v.sectionStarts) ? v.sectionStarts.map(Number).filter((n) => n >= 1) : [];
    const fixed = sections.map((s, i) => starts[i] ?? (i === 0 ? d.sectionStarts[0] : 0));
    for (let i = 1; i < fixed.length; i++) if (!fixed[i]) fixed[i] = fixed[i - 1] + sections[i - 1].count;
    return {
      nameStart: Number(v.nameStart) || d.nameStart,
      nameLen: Number(v.nameLen) || d.nameLen,
      noStart: Number(v.noStart) || d.noStart,
      noLen: Number(v.noLen) || d.noLen,
      bookletStart: v.bookletStart === 0 ? 0 : Number(v.bookletStart) || d.bookletStart,
      sectionStarts: fixed,
    };
  } catch {
    return d;
  }
}

/** Biçimi doğrular; hatalıysa mesaj döndürür. Alanlar 1–400 arası, uzunluklar 1–40. Bölüm blokları çakışamaz. */
export function readerFormatError(f: ReaderFormat, sections: Sec[]): string | null {
  const ok = (n: number, lo = 1, hi = 400) => Number.isInteger(n) && n >= lo && n <= hi;
  if (!ok(f.nameStart) || !ok(f.nameLen, 1, 40)) return "Ad soyad sütunu geçersiz.";
  if (!ok(f.noStart) || !ok(f.noLen, 1, 12)) return "Öğrenci no sütunu geçersiz.";
  if (f.bookletStart !== 0 && !ok(f.bookletStart)) return "Kitapçık sütunu geçersiz.";
  if (f.sectionStarts.length !== sections.length) return "Her bölüm için başlangıç sütunu girin.";
  const blocks = sections.map((s, i) => ({ name: s.name, a: f.sectionStarts[i], b: f.sectionStarts[i] + s.count - 1 }));
  for (const x of blocks) if (!ok(x.a)) return `${x.name}: başlangıç sütunu geçersiz.`;
  for (let i = 0; i < blocks.length; i++)
    for (let j = i + 1; j < blocks.length; j++)
      if (blocks[i].a <= blocks[j].b && blocks[j].a <= blocks[i].b) return `${blocks[i].name} ve ${blocks[j].name} cevap blokları çakışıyor.`;
  return null;
}

/**
 * Bir satırı okur. Cevaplar bütün bölümler arka arkaya (A kitapçığı sırasıyla değil, dosyadaki sırayla) döner:
 * geçerli şık harfi, çift işaret "*", diğer her şey boş " ".
 */
export function readLine(line: string, f: ReaderFormat, sections: Sec[], choices: number) {
  const cut = (start: number, len: number) => line.slice(start - 1, start - 1 + len);
  const allowed = LETTERS.slice(0, choices);
  const answers = sections
    .map((s, i) =>
      cut(f.sectionStarts[i], s.count)
        .padEnd(s.count, " ")
        .toUpperCase()
        .split("")
        .map((ch) => (allowed.includes(ch) ? ch : ch === "*" ? "*" : " "))
        .join(""),
    )
    .join("");
  return {
    name: cut(f.nameStart, f.nameLen).trim(),
    studentNo: cut(f.noStart, f.noLen).trim(),
    booklet: f.bookletStart ? cut(f.bookletStart, 1).trim().toUpperCase() : "",
    answers,
  };
}

/** Örnek dosya üretmek için satır yazar (readLine'ın tersi). */
export function writeLine(p: { name: string; studentNo: string; booklet: string; answers: string }, f: ReaderFormat, sections: Sec[]) {
  const width = Math.max(f.nameStart + f.nameLen, f.noStart + f.noLen, f.bookletStart + 1, ...sections.map((s, i) => f.sectionStarts[i] + s.count)) - 1;
  const line = Array(width).fill(" ");
  const put = (start: number, s: string) => s.split("").forEach((ch, i) => (line[start - 1 + i] = ch));
  put(f.nameStart, p.name.slice(0, f.nameLen).padEnd(f.nameLen, " "));
  put(f.noStart, p.studentNo.padStart(f.noLen, "0").slice(-f.noLen));
  if (f.bookletStart) put(f.bookletStart, p.booklet);
  let at = 0;
  sections.forEach((s, i) => {
    put(f.sectionStarts[i], p.answers.slice(at, at + s.count));
    at += s.count;
  });
  return line.join("");
}
