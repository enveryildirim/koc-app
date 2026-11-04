/**
 * Optik form düzeni. Tüm koordinatlar A4 sayfası üzerinde milimetre cinsindendir.
 * Yazdırılan form (SVG), örnek form üreticisi (canvas) ve tarayıcı aynı düzeni kullanır.
 */

export const PAGE_W = 210;
export const PAGE_H = 297;

export const MARKER_SIZE = 8;
/** Köşe işaretlerinin merkezleri: sol-üst, sağ-üst, sağ-alt, sol-alt. */
export const MARKERS: [number, number][] = [
  [14, 14],
  [196, 14],
  [196, 283],
  [14, 283],
];

export const BUBBLE_R = 2.2;
export const CHOICES = ["A", "B", "C", "D", "E"];
export const MAX_QUESTIONS = 60;
export const STUDENT_DIGITS = 6;

const ROWS_PER_COL = 20;
const ANSWER_TOP = 128;
const ROW_H = 7.4;
const COL_X = [22, 85, 148];
const BUBBLE_DX = 6.2;

const STUDENT_X = 140;
const STUDENT_Y = 52;
const STUDENT_DX = 6.4;
const STUDENT_DY = 6.2;

export type Bubble = { x: number; y: number; label: string };

/** Soru numarası (0 tabanlı) için şık baloncukları. */
export function questionBubbles(q: number): Bubble[] {
  const col = Math.floor(q / ROWS_PER_COL);
  const row = q % ROWS_PER_COL;
  const x0 = COL_X[col] + 10;
  const y = ANSWER_TOP + row * ROW_H;
  return CHOICES.map((label, k) => ({ x: x0 + k * BUBBLE_DX, y, label }));
}

export function questionLabelPos(q: number) {
  const col = Math.floor(q / ROWS_PER_COL);
  const row = q % ROWS_PER_COL;
  return { x: COL_X[col] + 4.5, y: ANSWER_TOP + row * ROW_H };
}

/** Öğrenci numarası basamağı (sütun) için 0-9 baloncukları. */
export function studentBubbles(col: number): Bubble[] {
  return Array.from({ length: 10 }, (_, d) => ({
    x: STUDENT_X + col * STUDENT_DX,
    y: STUDENT_Y + 8 + d * STUDENT_DY,
    label: String(d),
  }));
}

export const STUDENT_BOX = {
  x: STUDENT_X - 5,
  y: STUDENT_Y - 6,
  w: STUDENT_DIGITS * STUDENT_DX + 3.6,
  h: 8 + 10 * STUDENT_DY + 2,
};

export const ANSWER_BOX = { x: 16, y: ANSWER_TOP - 9, w: 178, h: ROWS_PER_COL * ROW_H + 6 };

/** Formdaki soru: kaç şık kullanıldığı (Doğru/Yanlış için 2). */
export type FormQuestion = { choiceCount: number };

/* ----------------------------- Çizim primitifleri ----------------------------- */

export type Prim =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; r?: number }
  | { kind: "circle"; x: number; y: number; r: number; fill?: string; stroke?: string; sw?: number }
  | { kind: "text"; x: number; y: number; text: string; size: number; fill?: string; anchor?: "start" | "middle" | "end"; bold?: boolean }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number };

export type FormInfo = {
  title: string;
  brand: string;
  questions: FormQuestion[];
};

export function buildForm(info: FormInfo): Prim[] {
  const p: Prim[] = [];
  const ink = "#1f2937";
  const soft = "#9ca3af";

  for (const [x, y] of MARKERS) {
    p.push({ kind: "rect", x: x - MARKER_SIZE / 2, y: y - MARKER_SIZE / 2, w: MARKER_SIZE, h: MARKER_SIZE, fill: "#000" });
  }

  p.push({ kind: "text", x: 26, y: 17, text: info.brand.toUpperCase() + " · OPTİK CEVAP FORMU", size: 3.2, fill: soft, bold: true });
  p.push({ kind: "text", x: 26, y: 27, text: truncate(info.title, 48), size: 6, fill: ink, bold: true });

  // Kimlik alanları
  const fields = ["Ad Soyad", "Sınıf / Şube", "Tarih", "İmza"];
  fields.forEach((f, i) => {
    const y = 48 + i * 15;
    p.push({ kind: "text", x: 22, y, text: f, size: 3.2, fill: "#4b5563" });
    p.push({ kind: "line", x1: 22, y1: y + 7, x2: 122, y2: y + 7, stroke: "#d1d5db", sw: 0.3 });
  });

  // Öğrenci numarası
  p.push({ kind: "rect", ...STUDENT_BOX, stroke: "#d1d5db", sw: 0.3, r: 1.5 });
  p.push({ kind: "text", x: STUDENT_BOX.x + STUDENT_BOX.w / 2, y: STUDENT_BOX.y - 2, text: "ÖĞRENCİ NUMARASI", size: 2.8, fill: "#4b5563", anchor: "middle", bold: true });
  for (let c = 0; c < STUDENT_DIGITS; c++) {
    const bs = studentBubbles(c);
    p.push({ kind: "rect", x: bs[0].x - 2.6, y: STUDENT_BOX.y + 1, w: 5.2, h: 5, stroke: "#9ca3af", sw: 0.25 });
    for (const b of bs) bubble(p, b);
  }

  // Cevap alanı
  p.push({ kind: "rect", ...ANSWER_BOX, stroke: "#d1d5db", sw: 0.3, r: 1.5 });
  p.push({ kind: "text", x: ANSWER_BOX.x + 2, y: ANSWER_BOX.y - 2, text: "CEVAPLAR", size: 2.8, fill: "#4b5563", bold: true });
  info.questions.slice(0, MAX_QUESTIONS).forEach((q, i) => {
    const lp = questionLabelPos(i);
    p.push({ kind: "text", x: lp.x, y: lp.y + 1.1, text: String(i + 1), size: 3, fill: ink, anchor: "end", bold: true });
    questionBubbles(i)
      .slice(0, q.choiceCount)
      .forEach((b) => bubble(p, b));
  });

  p.push({
    kind: "text",
    x: PAGE_W / 2,
    y: 290,
    text: "Yalnızca koyu kurşun kalem kullanın · Baloncuğu tamamen doldurun · Köşedeki siyah kareleri kapatmayın",
    size: 2.6,
    fill: soft,
    anchor: "middle",
  });
  return p;
}

function bubble(p: Prim[], b: Bubble) {
  p.push({ kind: "circle", x: b.x, y: b.y, r: BUBBLE_R, stroke: "#6b7280", sw: 0.25 });
  p.push({ kind: "text", x: b.x, y: b.y + 0.85, text: b.label, size: 2.3, fill: "#c4c8ce", anchor: "middle" });
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Bir sorunun forma basılacak şık sayısı. Form yalnızca tek cevaplı soruları destekler. */
export function choiceCountFor(q: { type: string; options: unknown[] }) {
  if (q.type === "TRUE_FALSE") return 2;
  if (q.type === "SINGLE") return Math.min(q.options.length, CHOICES.length);
  return 0;
}
