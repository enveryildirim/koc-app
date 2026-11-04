/** Deneme sınavı (LGS / TYT / AYT / serbest) alan mantığı: şablonlar, net hesabı. */

export type ExamSection = { name: string; count: number; keyA: string; keyB: string };
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
export function gradeExam(sections: ExamSection[], answers: string, booklet: string, wrongPer: number) {
  let offset = 0;
  const stats: SectionStat[] = sections.map((s) => {
    const key = (booklet === "B" ? s.keyB || s.keyA : s.keyA).toUpperCase();
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
  return { stats, totalNet };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Öğrenci numaralarını karşılaştırmak için baştaki sıfırları atar. */
export const normNo = (s: string) => s.replace(/\D/g, "").replace(/^0+/, "") || "0";

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
