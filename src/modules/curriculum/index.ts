/** curriculum — müfredat: ders + düzey için ünite / konu / kazanım listesi (istemci + sunucu güvenli). */
export { SAMPLE_CURRICULUM } from "./sample";

export type CurriculumRow = {
  subject: string;
  grade: string;
  unit: string;
  topic: string;
  code: string;
  outcome: string;
  weeks: number;
};

/** Düzeyler (soru havuzundaki ile aynı). */
export const CURRICULUM_GRADES = ["5", "6", "7", "8", "9", "10", "11", "12", "LGS", "TYT", "AYT"];

export const gradeLabel = (g: string) => (/^\d+$/.test(g) ? `${g}. sınıf` : g);

const EXAM_GRADES = ["LGS", "TYT", "AYT"];
/** Sıralama: sayısal sınıflar, sonra sınav düzeyleri, sonra kuruma özgü düzeyler (Seviye-2…). */
export const gradeSortKey = (g: string) => (/^\d+$/.test(g) ? g.padStart(2, "0") : EXAM_GRADES.includes(g) ? `y${EXAM_GRADES.indexOf(g)}` : `z${g}`);

/**
 * Müfredat düzey seçenekleri: kurumun sınıf düzeyleri (9, 10, Seviye-2…), bunlara uyan sınav düzeyleri
 * (8 → LGS; 11 / 12 → TYT, AYT) ve var olan setlerin düzeyleri. Hiçbir sınıfa düzey girilmemişse standart liste.
 */
export function curriculumGradeOptions(classLevels: string[], existing: string[] = []) {
  const levels = classLevels.map((l) => normGrade(l)).filter(Boolean);
  const exam = [...(levels.includes("8") ? ["LGS"] : []), ...(levels.some((l) => l === "11" || l === "12") ? ["TYT", "AYT"] : [])];
  const all = [...new Set([...levels, ...exam, ...existing])];
  return (all.length ? all : CURRICULUM_GRADES).sort((a, b) => gradeSortKey(a).localeCompare(gradeSortKey(b), "tr"));
}

/**
 * Bir düzeyin takipte hangi sınıflara ve deneme türlerine karşılık geldiği.
 * levels: Classroom.level değerleri; examTypes: Exam.type değerleri; grades: soru havuzundaki düzey değerleri.
 */
export function gradeScope(grade: string) {
  const map: Record<string, { levels: string[]; examTypes: string[]; grades: string[] }> = {
    "8": { levels: ["8"], examTypes: ["LGS"], grades: ["8", "LGS"] },
    LGS: { levels: ["8"], examTypes: ["LGS"], grades: ["8", "LGS"] },
    "11": { levels: ["11"], examTypes: ["TYT", "AYT"], grades: ["11"] },
    "12": { levels: ["12"], examTypes: ["TYT", "AYT"], grades: ["12", "TYT", "AYT"] },
    TYT: { levels: ["11", "12"], examTypes: ["TYT"], grades: ["TYT", "11", "12"] },
    AYT: { levels: ["11", "12"], examTypes: ["AYT"], grades: ["AYT", "11", "12"] },
  };
  return map[grade] ?? { levels: [grade], examTypes: [], grades: [grade] };
}

/**
 * Müfredat satırlarından yıllık plan metni ("Konu | hafta" satırları). Ünite değiştikçe "# Ünite" başlığı yazılır
 * (setin hiç ünitesi yoksa başlık yok). Aynı ünitede art arda aynı konu gelirse haftalar toplanır.
 */
export function planSourceOf(rows: Pick<CurriculumRow, "topic" | "weeks" | "unit">[]) {
  const merged: { topic: string; weeks: number; unit: string }[] = [];
  for (const r of rows) {
    const last = merged[merged.length - 1];
    if (last && last.unit === r.unit && last.topic.toLocaleLowerCase("tr-TR") === r.topic.toLocaleLowerCase("tr-TR")) last.weeks += r.weeks;
    else merged.push({ topic: r.topic, weeks: r.weeks, unit: r.unit });
  }
  const withUnits = merged.some((m) => m.unit);
  const out: string[] = [];
  merged.forEach((m, i) => {
    if (withUnits && (i === 0 || merged[i - 1].unit !== m.unit)) out.push(`# ${m.unit}`);
    out.push(m.weeks > 1 ? `${m.topic} | ${Math.min(20, m.weeks)}` : m.topic);
  });
  return out.join("\n");
}

/** Konu eşleştirme anahtarı: büyük-küçük harf, şapka ve boşluk farkı gözetilmez. */
export const topicKey = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/* ------------------------------- Excel ------------------------------- */

type Field = keyof CurriculumRow;

/** Excel sütunları: başlık, kabul edilen başlık yazımları. Şablon ve dışa aktarma bu sırayı kullanır. */
export const CURRICULUM_COLUMNS: { key: Field; label: string; aliases: string[]; required?: boolean }[] = [
  { key: "subject", label: "Ders", aliases: ["ders", "ders adi", "brans"], required: true },
  { key: "grade", label: "Sınıf", aliases: ["sinif", "duzey", "sinif duzeyi", "seviye"], required: true },
  { key: "unit", label: "Ünite", aliases: ["unite", "unite adi", "ogrenme alani", "tema"] },
  { key: "topic", label: "Konu", aliases: ["konu", "konu adi", "alt konu"], required: true },
  { key: "code", label: "Kazanım kodu", aliases: ["kazanim kodu", "kod", "kazanim no"] },
  { key: "outcome", label: "Kazanım", aliases: ["kazanim", "kazanim aciklamasi", "aciklama"] },
  { key: "weeks", label: "Hafta", aliases: ["hafta", "hafta sayisi", "sure", "sure hafta"] },
];

const normH = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "8", "8. sınıf", "8.Sınıf", "lgs" → "8" / "LGS"; tanınmazsa olduğu gibi (kırpılmış). */
export function normGrade(v: string) {
  const s = String(v ?? "").trim();
  const num = s.match(/^(\d{1,2})\s*\.?\s*(sınıf|sinif)?$/i);
  if (num) return String(Number(num[1]));
  const up = s.toLocaleUpperCase("tr-TR");
  return ["LGS", "TYT", "AYT"].includes(up) ? up : s;
}

/**
 * Excel / CSV tablosunu (ilk satır başlık) müfredat satırlarına çevirir.
 * Hatalı satırlar `errors` ile bildirilir ve sonuca girmez; ders / sınıf boşsa üstteki satırınki kullanılır
 * (Excel'de birleştirilmiş hücreler böyle okunur).
 */
export function parseCurriculumTable(table: unknown[][]): { rows: CurriculumRow[]; errors: string[]; missing: string[] } {
  if (table.length < 2) return { rows: [], errors: [], missing: ["başlık satırı ve en az bir konu"] };
  const header = table[0].map((h) => normH(String(h ?? "")));
  const idx = Object.fromEntries(CURRICULUM_COLUMNS.map((c) => [c.key, header.findIndex((h) => h === normH(c.label) || c.aliases.includes(h))])) as Record<Field, number>;
  const missing = CURRICULUM_COLUMNS.filter((c) => c.required && idx[c.key] < 0).map((c) => c.label);
  if (missing.length) return { rows: [], errors: [], missing };

  const rows: CurriculumRow[] = [];
  const errors: string[] = [];
  let prev = { subject: "", grade: "", unit: "" };
  table.slice(1).forEach((r, i) => {
    const get = (k: Field) => (idx[k] >= 0 ? String(r[idx[k]] ?? "").trim() : "");
    if (!r.some((c) => String(c ?? "").trim())) return;
    const subject = get("subject") || prev.subject;
    const grade = normGrade(get("grade") || prev.grade);
    // Ünite boşsa aynı ders + sınıfta üstteki ünite sürer (birleştirilmiş hücre).
    const unit = get("unit") || (subject === prev.subject && grade === prev.grade ? prev.unit : "");
    const topic = get("topic");
    const weeksRaw = get("weeks").replace(",", ".");
    const weeks = weeksRaw ? Number(weeksRaw) : 1;
    const line = i + 2;
    if (!subject || !grade) return errors.push(`${line}. satır: ders ve sınıf gerekli.`);
    if (!topic) return errors.push(`${line}. satır: konu boş.`);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 20) return errors.push(`${line}. satır: hafta 1–20 arası tam sayı olmalı.`);
    rows.push({
      subject: subject.slice(0, 60),
      grade: grade.slice(0, 20),
      unit: unit.slice(0, 120),
      topic: topic.slice(0, 120),
      code: get("code").slice(0, 40),
      outcome: get("outcome").slice(0, 400),
      weeks,
    });
    prev = { subject, grade, unit };
  });
  return { rows, errors, missing: [] };
}

/** Konu önerilerini birleştirir: önce müfredat sırası, ardından müfredatta olmayan mevcut adlar. */
export function mergeTopicSuggestions(curriculum: Record<string, string[]>, existing: Record<string, string[]>) {
  const out: Record<string, string[]> = {};
  for (const [s, list] of [...Object.entries(curriculum), ...Object.entries(existing)]) {
    const cur = (out[s] ??= []);
    for (const t of list) if (!cur.some((x) => x.toLocaleLowerCase("tr-TR") === t.toLocaleLowerCase("tr-TR"))) cur.push(t);
  }
  return out;
}
