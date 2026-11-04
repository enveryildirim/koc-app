/**
 * Optik form düzeni (parametrik). Tüm koordinatlar A4 sayfası üzerinde milimetre cinsindendir.
 * Yazdırılan form (SVG), örnek form üreticisi (canvas) ve tarayıcı aynı `computeLayout` çıktısını kullanır.
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

export const CHOICES = ["A", "B", "C", "D", "E"];
export const MAX_QUESTIONS = 180;
export const STUDENT_DIGITS = 6;

const AREA_X = 18;
const AREA_W = 174;
const ANSWER_TOP = 128;
const ANSWER_BOTTOM = 274;
const DX = 4.8;
const MAX_ROW_H = 7.4;
const STUDENT_X = 140;
const STUDENT_Y = 52;
const STUDENT_DX = 6.4;
const STUDENT_DY = 6.2;

export type Bubble = { x: number; y: number; label: string };

/** Formdaki soru: kaç şık kullanıldığı (Doğru/Yanlış için 2). */
export type FormQuestion = { choiceCount: number };

export type FormSpec = {
  title: string;
  brand: string;
  questions: FormQuestion[];
  /** İsteğe bağlı bölüm başlıkları; count toplamı soru sayısına eşit olmalı. */
  sections?: { name: string; count: number }[];
  /** A/B kitapçık türü alanı */
  booklet?: boolean;
};
/** Geriye dönük uyumluluk için. */
export type FormInfo = FormSpec;

export type Layout = {
  r: number;
  questions: Bubble[][];
  qLabels: { x: number; y: number; text: string }[];
  headers: { x: number; y: number; text: string; w: number }[];
  student: Bubble[][];
  booklet: Bubble[];
  answerBox: { x: number; y: number; w: number; h: number };
  studentBox: { x: number; y: number; w: number; h: number };
};

type Slot = { kind: "q"; q: number; label: string } | { kind: "h"; text: string } | { kind: "pad" };

export function computeLayout(spec: FormSpec): Layout {
  const questions = spec.questions.slice(0, MAX_QUESTIONS);
  const C = Math.max(2, ...questions.map((q) => q.choiceCount));
  const colW = 7 + C * DX + 2;
  const maxCols = Math.max(1, Math.floor(AREA_W / colW));

  // Bölümlere göre satır listesi (başlık + sorular); bölüm içinde numara 1'den başlar.
  const slots: Slot[] = [];
  const secs = spec.sections?.length ? spec.sections : [{ name: "", count: questions.length }];
  let q = 0;
  for (const s of secs) {
    if (s.name) slots.push({ kind: "h", text: s.name });
    for (let i = 0; i < s.count && q < questions.length; i++, q++) {
      slots.push({ kind: "q", q, label: String(spec.sections?.length ? i + 1 : q + 1) });
    }
  }

  const cols = Math.min(maxCols, Math.max(1, Math.ceil(slots.length / 20)));
  let R = Math.ceil(slots.length / cols);
  let placed: Slot[][] = [];
  for (;;) {
    placed = [[]];
    for (const s of slots) {
      let col = placed[placed.length - 1];
      // Başlık bir sütunun son satırına düşmesin
      if (s.kind === "h" && col.length >= R - 1 && col.length > 0) {
        placed.push([]);
        col = placed[placed.length - 1];
      }
      if (col.length >= R) {
        placed.push([]);
        col = placed[placed.length - 1];
      }
      // Sütun başında başlık yoksa ve bölüm devam ediyorsa sorun değil
      col.push(s);
    }
    if (placed.length <= cols) break;
    R++;
  }

  const rowH = Math.min(MAX_ROW_H, (ANSWER_BOTTOM - ANSWER_TOP) / R);
  const r = Math.min(2.2, rowH * 0.34, DX * 0.4);
  const spacing = Math.min(AREA_W / cols, 62);

  const qBubbles: Bubble[][] = Array.from({ length: questions.length }, () => []);
  const qLabels: Layout["qLabels"] = [];
  const headers: Layout["headers"] = [];
  placed.forEach((col, ci) => {
    const x0 = AREA_X + ci * spacing;
    col.forEach((s, ri) => {
      const y = ANSWER_TOP + ri * rowH + rowH / 2;
      if (s.kind === "h") headers.push({ x: x0 + 1, y, text: s.text, w: colW - 3 });
      else if (s.kind === "q") {
        qLabels.push({ x: x0 + 6, y, text: s.label });
        qBubbles[s.q] = CHOICES.slice(0, questions[s.q].choiceCount).map((label, k) => ({ x: x0 + 9.5 + k * DX, y, label }));
      }
    });
  });

  const student = Array.from({ length: STUDENT_DIGITS }, (_, c) =>
    Array.from({ length: 10 }, (_, d) => ({ x: STUDENT_X + c * STUDENT_DX, y: STUDENT_Y + 8 + d * STUDENT_DY, label: String(d) })),
  );
  const booklet = spec.booklet
    ? ["A", "B"].map((label, k) => ({ x: 50 + k * 8, y: 112, label }))
    : [];

  return {
    r,
    questions: qBubbles,
    qLabels,
    headers,
    student,
    booklet,
    answerBox: { x: AREA_X - 2, y: ANSWER_TOP - 6, w: AREA_W + 4, h: R * rowH + 8 },
    studentBox: {
      x: STUDENT_X - 5,
      y: STUDENT_Y - 6,
      w: STUDENT_DIGITS * STUDENT_DX + 3.6,
      h: 8 + 10 * STUDENT_DY + 2,
    },
  };
}

/* ----------------------------- Çizim primitifleri ----------------------------- */

export type Prim =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; r?: number }
  | { kind: "circle"; x: number; y: number; r: number; fill?: string; stroke?: string; sw?: number }
  | { kind: "text"; x: number; y: number; text: string; size: number; fill?: string; anchor?: "start" | "middle" | "end"; bold?: boolean }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number };

export function buildForm(spec: FormSpec, layout = computeLayout(spec)): Prim[] {
  const p: Prim[] = [];
  const ink = "#1f2937";
  const soft = "#9ca3af";
  const L = layout;

  for (const [x, y] of MARKERS) {
    p.push({ kind: "rect", x: x - MARKER_SIZE / 2, y: y - MARKER_SIZE / 2, w: MARKER_SIZE, h: MARKER_SIZE, fill: "#000" });
  }

  p.push({ kind: "text", x: 26, y: 17, text: spec.brand.toUpperCase() + " · OPTİK CEVAP FORMU", size: 3.2, fill: soft, bold: true });
  p.push({ kind: "text", x: 26, y: 27, text: truncate(spec.title, 48), size: 6, fill: ink, bold: true });

  const fields = ["Ad Soyad", "Sınıf / Şube", "Tarih", "İmza"];
  fields.forEach((f, i) => {
    const y = 42 + i * 14;
    p.push({ kind: "text", x: 22, y, text: f, size: 3.2, fill: "#4b5563" });
    p.push({ kind: "line", x1: 22, y1: y + 7, x2: 122, y2: y + 7, stroke: "#d1d5db", sw: 0.3 });
  });

  if (L.booklet.length) {
    p.push({ kind: "text", x: 22, y: L.booklet[0].y + 1.1, text: "KİTAPÇIK TÜRÜ", size: 3, fill: "#4b5563", bold: true });
    for (const b of L.booklet) bubble(p, b, 2.2);
  }

  // Öğrenci numarası
  p.push({ kind: "rect", ...L.studentBox, stroke: "#d1d5db", sw: 0.3, r: 1.5 });
  p.push({ kind: "text", x: L.studentBox.x + L.studentBox.w / 2, y: L.studentBox.y - 2, text: "ÖĞRENCİ NUMARASI", size: 2.8, fill: "#4b5563", anchor: "middle", bold: true });
  for (const col of L.student) {
    p.push({ kind: "rect", x: col[0].x - 2.6, y: L.studentBox.y + 1, w: 5.2, h: 5, stroke: "#9ca3af", sw: 0.25 });
    for (const b of col) bubble(p, b, 2.2);
  }

  // Cevap alanı
  p.push({ kind: "rect", ...L.answerBox, stroke: "#d1d5db", sw: 0.3, r: 1.5 });
  p.push({ kind: "text", x: L.answerBox.x + 2, y: L.answerBox.y - 2, text: "CEVAPLAR", size: 2.8, fill: "#4b5563", bold: true });
  for (const h of L.headers) {
    p.push({ kind: "rect", x: h.x, y: h.y - 2.4, w: h.w, h: 4.2, fill: "#eef2f7", r: 0.8 });
    p.push({ kind: "text", x: h.x + 1.2, y: h.y + 0.9, text: truncate(h.text.toLocaleUpperCase("tr-TR"), 18), size: 2.5, fill: "#374151", bold: true });
  }
  for (const l of L.qLabels) {
    p.push({ kind: "text", x: l.x, y: l.y + 1, text: l.text, size: Math.min(3, L.r * 1.4), fill: ink, anchor: "end", bold: true });
  }
  for (const qb of L.questions) for (const b of qb) bubble(p, b, L.r);

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

function bubble(p: Prim[], b: Bubble, r: number) {
  p.push({ kind: "circle", x: b.x, y: b.y, r, stroke: "#6b7280", sw: 0.25 });
  p.push({ kind: "text", x: b.x, y: b.y + r * 0.38, text: b.label, size: r * 1.05, fill: "#c4c8ce", anchor: "middle" });
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Bir online test sorusunun forma basılacak şık sayısı. Form yalnızca tek cevaplı soruları destekler. */
export function choiceCountFor(q: { type: string; options: unknown[] }) {
  if (q.type === "TRUE_FALSE") return 2;
  if (q.type === "SINGLE") return Math.min(q.options.length, CHOICES.length);
  return 0;
}
