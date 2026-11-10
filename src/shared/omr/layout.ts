/**
 * Optik form düzeni (parametrik). Tüm koordinatlar A4 sayfası üzerinde milimetre cinsindendir.
 * Yazdırılan form (SVG), örnek form üreticisi (canvas) ve tarayıcı aynı `computeLayout` çıktısını kullanır.
 *
 * Sürümler: baloncukların yeri sürüme göre değişir. Okuyucu formun sürümünü kâğıttaki sürüm işaretinden
 * (VERSION_MARK) anlar; böylece eski basılmış formlar da kendi ölçüleriyle okunur.
 * - 1: bilgi alanları uzun satırlar, öğrenci numarası sağda dikey, cevaplar 128 mm'den.
 * - 2 (varsayılan): bilgiler tek satır, öğrenci numarası solda yatay, cevaplar 98 mm'den; sürüm işareti var.
 */
import { encodeStudentId, ID_BITS } from "./idcode";

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

/**
 * Yön işareti: sol üst köşe karesinin altındaki küçük kare. Okuyucu dört olası yönelimden bu karenin
 * dolu göründüğünü seçer; böylece ters ya da yan çekilmiş fotoğraflar da okunur. İşareti olmayan
 * eski formlarda okuyucu düz yönelimi varsayar.
 */
export const ORIENT_MARK: [number, number] = [14, 25];
export const ORIENT_SIZE = 4;

/** Basılan yeni formların sürümü. */
export const FORM_VERSION = 2;
export type FormVersion = 1 | 2;
/**
 * Sürüm işareti (sürüm 2+): yön karesinin altında küçük dolu kare. Sürüm 1'de bu nokta boştur.
 * Köşe karesi sayılmaması için küçüktür; yön denetiminin baktığı noktalardan hiçbirine denk gelmez.
 */
export const VERSION_MARK: [number, number] = [14, 40];
export const VERSION_SIZE = 4;

/** Kişisel formun kimlik şeridi (alt kenar, köşe kareleri arasında). Bkz. idcode.ts */
const ID_X0 = 36;
const ID_PITCH = 4.4;
const ID_Y = 283;
export const ID_CELL = 2.8;

export const CHOICES = ["A", "B", "C", "D", "E"];
export const MAX_QUESTIONS = 180;
export const STUDENT_DIGITS = 6;

const AREA_X = 18;
const AREA_W = 174;
const ANSWER_TOP_V: Record<FormVersion, number> = { 1: 128, 2: 98 };
const ANSWER_BOTTOM = 274;
const DX = 4.8;
const MAX_ROW_H = 7.4;
const STUDENT_X = 140;
const STUDENT_Y = 52;
const STUDENT_DX = 6.4;
const STUDENT_DY = 6.2;
/** Sürüm 2: öğrenci numarası yatay (her satır bir hane, sütunlar 0–9) */
const S2 = { x0: 33, y0: 57, dx: 5.2, dy: 5, box: { x: 20, y: 49, w: 66, h: 36 } };
/** Sürüm 2: kitapçık baloncukları (en fazla 4) */
const B2 = { x0: 96, y: 59, dx: 7 };

export type Bubble = { x: number; y: number; label: string };

/** Formdaki soru: kaç şık kullanıldığı (Doğru/Yanlış için 2). */
export type FormQuestion = { choiceCount: number };

export type FormSpec = {
  title: string;
  brand: string;
  questions: FormQuestion[];
  /** İsteğe bağlı bölüm başlıkları; count toplamı soru sayısına eşit olmalı. */
  sections?: { name: string; count: number }[];
  /** Kitapçık türü alanındaki harfler (ör. ["A","B"] ya da ["A","B","C","D"]); boş / tek harf = alan yok. */
  booklets?: string[];
  /**
   * Kişisel form: öğrenci bilgisi basılır, numara kodlama alanı yerine QR ve alt kenarda kimlik şeridi çıkar.
   * Cevap ve kitapçık alanlarının yeri değişmez; okuyucu genel ve kişisel formu aynı düzenle okur.
   */
  personal?: { studentNo: string; name: string; className: string; qr?: { size: number; data: number[] } };
  /** Düzen sürümü; verilmezse FORM_VERSION (yeni basım). Okuyucu kâğıttaki işarete göre seçer. */
  version?: FormVersion;
};
/** Geriye dönük uyumluluk için. */
export type FormInfo = FormSpec;

export type Layout = {
  version: FormVersion;
  r: number;
  questions: Bubble[][];
  qLabels: { x: number; y: number; text: string }[];
  headers: { x: number; y: number; text: string; w: number }[];
  student: Bubble[][];
  booklet: Bubble[];
  /** Kimlik şeridi hücre merkezleri (32). Her düzende vardır; yalnızca kişisel formda basılır. */
  idStrip: { x: number; y: number }[];
  answerBox: { x: number; y: number; w: number; h: number };
  studentBox: { x: number; y: number; w: number; h: number };
  /** Numara hanelerinin elle yazıldığı kutuların merkezleri (hane sırasıyla) */
  studentWrite: { x: number; y: number }[];
  /** Ad soyadın yazıldığı yer (örnek form üreticisi için) */
  nameAt: { x: number; y: number };
};

type Slot = { kind: "q"; q: number; label: string } | { kind: "h"; text: string } | { kind: "pad" };

export function computeLayout(spec: FormSpec): Layout {
  const version: FormVersion = spec.version ?? FORM_VERSION;
  const ANSWER_TOP = ANSWER_TOP_V[version];
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

  // Kişisel formda numara alanı basılmaz (yerinde QR olur); okuyucu numarayı kimlik şeridinden okur.
  const v1 = version === 1;
  const student = spec.personal ? [] : Array.from({ length: STUDENT_DIGITS }, (_, c) =>
    Array.from({ length: 10 }, (_, d) =>
      v1
        ? { x: STUDENT_X + c * STUDENT_DX, y: STUDENT_Y + 8 + d * STUDENT_DY, label: String(d) }
        : { x: S2.x0 + d * S2.dx, y: S2.y0 + c * S2.dy, label: String(d) },
    ),
  );
  // Sürüm 1: en fazla 4 baloncuk x 50–74 mm, y 112. Sürüm 2: numaranın sağında, x 96'dan.
  const booklet = (spec.booklets?.length ?? 0) > 1
    ? spec.booklets!.slice(0, 4).map((label, k) => (v1 ? { x: 50 + k * 8, y: 112, label } : { x: B2.x0 + k * B2.dx, y: B2.y, label }))
    : [];
  const studentBox = v1
    ? { x: STUDENT_X - 5, y: STUDENT_Y - 6, w: STUDENT_DIGITS * STUDENT_DX + 3.6, h: 8 + 10 * STUDENT_DY + 2 }
    : S2.box;

  return {
    version,
    r,
    questions: qBubbles,
    qLabels,
    headers,
    student,
    booklet,
    idStrip: Array.from({ length: ID_BITS }, (_, i) => ({ x: ID_X0 + i * ID_PITCH, y: ID_Y })),
    answerBox: { x: AREA_X - 2, y: ANSWER_TOP - 6, w: AREA_W + 4, h: R * rowH + 8 },
    studentBox,
    studentWrite: Array.from({ length: STUDENT_DIGITS }, (_, c) =>
      v1 ? { x: STUDENT_X + c * STUDENT_DX, y: STUDENT_Y + 2.5 } : { x: 24.5, y: S2.y0 + c * S2.dy },
    ),
    nameAt: v1 ? { x: 49, y: 41.8 } : { x: 40, y: 40.2 },
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
  const { rule, cellFill, labelInk } = TONES;

  for (const [x, y] of MARKERS) {
    p.push({ kind: "rect", x: x - MARKER_SIZE / 2, y: y - MARKER_SIZE / 2, w: MARKER_SIZE, h: MARKER_SIZE, fill: "#000" });
  }
  p.push({ kind: "rect", x: ORIENT_MARK[0] - ORIENT_SIZE / 2, y: ORIENT_MARK[1] - ORIENT_SIZE / 2, w: ORIENT_SIZE, h: ORIENT_SIZE, fill: "#000" });
  if (L.version >= 2) p.push({ kind: "rect", x: VERSION_MARK[0] - VERSION_SIZE / 2, y: VERSION_MARK[1] - VERSION_SIZE / 2, w: VERSION_SIZE, h: VERSION_SIZE, fill: "#000" });

  p.push({ kind: "text", x: 26, y: 17, text: spec.brand.toUpperCase() + " · OPTİK CEVAP FORMU", size: 3.2, fill: soft, bold: true });
  p.push({ kind: "text", x: 26, y: 27, text: truncate(spec.title, 48), size: 6, fill: ink, bold: true });

  const per = spec.personal;
  if (per) drawIdStrip(p, per.studentNo, L);
  if (L.version === 1) headerV1(p, spec, L);
  else headerV2(p, spec, L);

  // Cevap alanı
  p.push({ kind: "rect", ...L.answerBox, stroke: rule, sw: 0.3 });
  p.push({ kind: "text", x: L.answerBox.x, y: L.answerBox.y - 1.6, text: "CEVAPLAR", size: 2.6, fill: labelInk, bold: true });
  for (const h of L.headers) {
    p.push({ kind: "rect", x: h.x, y: h.y - 2.4, w: h.w, h: 4.2, fill: cellFill });
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

const TONES = { ink: "#1f2937", soft: "#9ca3af", rule: "#9ca3af", cellFill: "#f3f4f6", labelInk: "#374151", note: "#6b7280" };

/** Kişisel formun kimlik şeridi (alt kenar; her iki sürümde aynı yerde). */
function drawIdStrip(p: Prim[], studentNo: string, L: Layout) {
  encodeStudentId(studentNo).forEach((on, i) => {
    const c = L.idStrip[i];
    if (on) p.push({ kind: "rect", x: c.x - ID_CELL / 2, y: c.y - ID_CELL / 2, w: ID_CELL, h: ID_CELL, fill: "#000" });
    else p.push({ kind: "rect", x: c.x - ID_CELL / 2, y: c.y - ID_CELL / 2, w: ID_CELL, h: ID_CELL, stroke: "#d1d5db", sw: 0.2 });
  });
}

/** QR kod (kişisel form): sol üst köşesi (x0, y0), kenarı side mm. */
function drawQr(p: Prim[], qr: { size: number; data: number[] }, x0: number, y0: number, side: number) {
  const m = side / qr.size;
  qr.data.forEach((v, i) => {
    if (!v) return;
    const r = Math.floor(i / qr.size);
    const c = i % qr.size;
    p.push({ kind: "rect", x: x0 + c * m, y: y0 + r * m, w: m + 0.02, h: m + 0.02, fill: "#000" });
  });
}

/** Sürüm 1 üst kısmı (eski düzen; yalnızca eski formları yeniden üretmek ve sınamak için). */
function headerV1(p: Prim[], spec: FormSpec, L: Layout) {
  const { ink, rule, cellFill, labelInk } = TONES;
  const per = spec.personal;
  // Bilgi alanları resmî form düzeninde: solda gri etiket hücresi, sağda yazma alanı. Okuyucu bu alanlara bakmaz;
  // baloncukların yeri (computeLayout) değişmediği için eski basılı formlar da aynı okunur.
  const LX = 20;
  const LW = 108;
  const LABEL_W = 26;
  /** Etiket hücreli şerit: labels birden çok satır olabilir. */
  const panel = (y: number, h: number, labels: string[]) => {
    p.push({ kind: "rect", x: LX, y, w: LABEL_W, h, fill: cellFill });
    p.push({ kind: "rect", x: LX, y, w: LW, h, stroke: rule, sw: 0.3 });
    p.push({ kind: "line", x1: LX + LABEL_W, y1: y, x2: LX + LABEL_W, y2: y + h, stroke: rule, sw: 0.3 });
    const y0 = y + h / 2 - ((labels.length - 1) * 3.2) / 2 + 0.85;
    labels.forEach((t, i) => p.push({ kind: "text", x: LX + 2.5, y: y0 + i * 3.2, text: t, size: 2.35, fill: labelInk, bold: true }));
  };

  // Öğrenci bilgileri: üç sıra
  const ROW = 8.5;
  const infoY = 36;
  const rows: [string, string | undefined][] = per
    ? [["AD SOYAD", per.name], ["SINIF / NUMARA", [per.className, per.studentNo].filter(Boolean).join(" · ")], ["İMZA", undefined]]
    : [["AD SOYAD", undefined], ["SINIF / ŞUBE", undefined], ["İMZA", undefined]];
  rows.forEach(([lbl, value], i) => {
    const y = infoY + i * ROW;
    p.push({ kind: "rect", x: LX, y, w: LABEL_W, h: ROW, fill: cellFill });
    p.push({ kind: "text", x: LX + 2.5, y: y + ROW / 2 + 0.85, text: lbl, size: 2.35, fill: labelInk, bold: true });
    if (value) p.push({ kind: "text", x: LX + LABEL_W + 3, y: y + ROW / 2 + 1.5, text: truncate(value, 38), size: 4.2, fill: ink, bold: true });
    if (i) p.push({ kind: "line", x1: LX, y1: y, x2: LX + LW, y2: y, stroke: rule, sw: 0.3 });
  });
  p.push({ kind: "rect", x: LX, y: infoY, w: LW, h: ROW * rows.length, stroke: rule, sw: 0.3 });
  p.push({ kind: "line", x1: LX + LABEL_W, y1: infoY, x2: LX + LABEL_W, y2: infoY + ROW * rows.length, stroke: rule, sw: 0.3 });

  // İşaretleme örneği: doğru (tam dolu) ve okunmayan yanlış işaretler (tik, çarpı, nokta)
  // Bilgi alanı ile kitapçık şeridi (ya da cevap alanı) arasında ortalanır
  const gH = 22;
  const infoEnd = infoY + ROW * rows.length;
  const below = L.booklet.length ? L.booklet[0].y - 5 : L.answerBox.y - 4;
  const gY = Math.round((infoEnd + (below - infoEnd - gH) / 2) * 10) / 10;
  panel(gY, gH, ["İŞARETLEME", "ÖRNEĞİ"]);
  const cy = gY + 8.5;
  const slot = (LW - LABEL_W) / 4;
  const cx = (i: number) => LX + LABEL_W + slot * (i + 0.5);
  const mark = "#4b5563";
  ["Doğru", "Yanlış", "Yanlış", "Yanlış"].forEach((caption, i) => {
    const ok = i === 0;
    p.push({ kind: "circle", x: cx(i), y: cy, r: 2.2, stroke: ok ? ink : rule, sw: 0.3, ...(ok ? { fill: ink } : {}) });
    p.push({ kind: "text", x: cx(i), y: cy + 7, text: caption, size: 2.3, fill: ok ? ink : "#6b7280", anchor: "middle", bold: ok });
  });
  p.push({ kind: "line", x1: LX + LABEL_W + slot, y1: gY + 3, x2: LX + LABEL_W + slot, y2: gY + gH - 3, stroke: "#d1d5db", sw: 0.3 });
  // tik
  p.push({ kind: "line", x1: cx(1) - 1.1, y1: cy + 0.1, x2: cx(1) - 0.2, y2: cy + 1.1, stroke: mark, sw: 0.35 });
  p.push({ kind: "line", x1: cx(1) - 0.2, y1: cy + 1.1, x2: cx(1) + 1.3, y2: cy - 1.1, stroke: mark, sw: 0.35 });
  // çarpı
  p.push({ kind: "line", x1: cx(2) - 1.1, y1: cy - 1.1, x2: cx(2) + 1.1, y2: cy + 1.1, stroke: mark, sw: 0.35 });
  p.push({ kind: "line", x1: cx(2) - 1.1, y1: cy + 1.1, x2: cx(2) + 1.1, y2: cy - 1.1, stroke: mark, sw: 0.35 });
  // nokta
  p.push({ kind: "circle", x: cx(3), y: cy, r: 0.55, fill: mark });

  // Kitapçık türü: baloncuklar sabit yerinde (x 50–74, y 112), şerit onların çevresine çizilir
  if (L.booklet.length) {
    const bY = L.booklet[0].y - 5;
    panel(bY, 10, ["KİTAPÇIK TÜRÜ"]);
    for (const b of L.booklet) bubble(p, b, 2.2);
    const last = L.booklet[L.booklet.length - 1];
    p.push({ kind: "text", x: last.x + 6, y: last.y + 0.8, text: "Kitapçığınızın harfini işaretleyin", size: 2.2, fill: "#6b7280" });
  }

  if (per) {
    // QR (insan ve telefon için) ve kimlik şeridi (okuyucu için)
    if (per.qr) {
      const side = 30;
      const m = side / per.qr.size;
      const x0 = L.studentBox.x + (L.studentBox.w - side) / 2;
      const y0 = L.studentBox.y + 4;
      per.qr.data.forEach((v, i) => {
        if (!v) return;
        const r = Math.floor(i / per.qr!.size);
        const c = i % per.qr!.size;
        p.push({ kind: "rect", x: x0 + c * m, y: y0 + r * m, w: m + 0.02, h: m + 0.02, fill: "#000" });
      });
      p.push({ kind: "text", x: L.studentBox.x + L.studentBox.w / 2, y: y0 + side + 5, text: "Başkasıyla değiştirmeyin", size: 2.4, fill: "#6b7280", anchor: "middle" });
    }
  }

  // Öğrenci numarası (kişisel formda QR): üstte gri başlık bandı, sol sütundaki etiket hücreleriyle aynı dil
  const SB = L.studentBox;
  p.push({ kind: "rect", x: SB.x, y: SB.y - 6.5, w: SB.w, h: 6.5, fill: cellFill, stroke: rule, sw: 0.3 });
  p.push({ kind: "text", x: SB.x + SB.w / 2, y: SB.y - 2.4, text: per ? "KİŞİYE ÖZEL FORM" : "ÖĞRENCİ NUMARASI", size: 2.35, fill: labelInk, anchor: "middle", bold: true });
  // Kişisel formda çerçeve QR ve notu kadar
  p.push({ kind: "rect", ...SB, ...(per ? { h: per.qr ? 44 : 10 } : {}), stroke: rule, sw: 0.3 });
  for (const col of L.student) {
    p.push({ kind: "rect", x: col[0].x - 2.6, y: L.studentBox.y + 1, w: 5.2, h: 5, stroke: "#9ca3af", sw: 0.25 });
    for (const b of col) bubble(p, b, 2.2);
  }

}

/**
 * Sürüm 2 üst kısmı: bilgiler kutusuz tek satır; solda yatay öğrenci numarası, sağında kitapçık türü ve
 * küçük işaretleme örneği; kişisel formda en sağda QR.
 */
function headerV2(p: Prim[], spec: FormSpec, L: Layout) {
  const { ink, rule, labelInk, note } = TONES;
  const per = spec.personal;

  // Bilgi satırı: etiket + alt çizgi (kişisel formda değer basılı)
  const lineY = 41.4;
  const fields: { label: string; x: number; lx: number; end: number; value?: string }[] = [
    { label: "Ad Soyad", x: 22, lx: 37, end: 118, value: per?.name },
    { label: "Sınıf / Şube", x: 122, lx: 141, end: 162, value: per?.className },
    { label: "İmza", x: 166, lx: 174, end: 192 },
  ];
  for (const f of fields) {
    p.push({ kind: "text", x: f.x, y: lineY - 0.6, text: f.label, size: 2.6, fill: labelInk, bold: true });
    p.push({ kind: "line", x1: f.lx, y1: lineY, x2: f.end, y2: lineY, stroke: rule, sw: 0.3 });
    if (f.value) p.push({ kind: "text", x: f.lx + 1, y: lineY - 1, text: truncate(f.value, f.end - f.lx > 40 ? 40 : 10), size: 3.6, fill: ink, bold: true });
  }

  const sec = (x: number, y: number, text: string) => p.push({ kind: "text", x, y, text, size: 2.3, fill: labelInk, bold: true });

  // Öğrenci numarası: her satır bir hane, solda yazma kutusu, sağda 0–9
  if (L.student.length) {
    const B = L.studentBox;
    p.push({ kind: "rect", ...B, stroke: rule, sw: 0.3 });
    sec(B.x + 2, B.y + 3.6, "ÖĞRENCİ NUMARASI");
    p.push({ kind: "text", x: B.x + B.w - 2, y: B.y + 3.6, text: "her satıra bir rakam", size: 2, fill: note, anchor: "end" });
    L.student.forEach((row, c) => {
      const w = L.studentWrite[c];
      p.push({ kind: "rect", x: w.x - 2.4, y: w.y - 2, w: 4.8, h: 4, stroke: "#9ca3af", sw: 0.25 });
      for (const b of row) bubble(p, b, 2);
    });
  }

  // Kişisel form: numara kodlanmaz (alt kenardaki kimlik şeridinden okunur); aynı yerde basılı olarak durur
  if (per) {
    const B = L.studentBox;
    p.push({ kind: "rect", ...B, stroke: rule, sw: 0.3 });
    sec(B.x + 2, B.y + 3.6, "ÖĞRENCİ NUMARASI");
    p.push({ kind: "text", x: B.x + B.w / 2, y: B.y + 21, text: per.studentNo, size: 9, fill: ink, anchor: "middle", bold: true });
    p.push({ kind: "text", x: B.x + B.w / 2, y: B.y + 30, text: "Numara basılıdır, kodlamayın", size: 2.2, fill: note, anchor: "middle" });
  }

  // Sağ sütun: kitapçık türü ve işaretleme örneği (kişisel formda en sağda QR)
  const RX = 92;
  if (L.booklet.length) {
    sec(RX, 53, "KİTAPÇIK TÜRÜ");
    for (const b of L.booklet) bubble(p, b, 2.2);
  }
  const gy = 76;
  sec(RX, gy - 5, "İŞARETLEME");
  const ex = [RX + 2.5, RX + 16, RX + 26, RX + 36];
  ex.forEach((x, i) => {
    const ok = i === 0;
    p.push({ kind: "circle", x, y: gy, r: 1.8, stroke: ok ? ink : rule, sw: 0.3, ...(ok ? { fill: ink } : {}) });
  });
  p.push({ kind: "text", x: ex[0] + 3, y: gy + 0.8, text: "doğru", size: 2.1, fill: ink, bold: true });
  p.push({ kind: "line", x1: ex[1] - 0.9, y1: gy + 0.1, x2: ex[1] - 0.15, y2: gy + 0.9, stroke: note, sw: 0.3 });
  p.push({ kind: "line", x1: ex[1] - 0.15, y1: gy + 0.9, x2: ex[1] + 1.05, y2: gy - 0.9, stroke: note, sw: 0.3 });
  p.push({ kind: "line", x1: ex[2] - 0.9, y1: gy - 0.9, x2: ex[2] + 0.9, y2: gy + 0.9, stroke: note, sw: 0.3 });
  p.push({ kind: "line", x1: ex[2] - 0.9, y1: gy + 0.9, x2: ex[2] + 0.9, y2: gy - 0.9, stroke: note, sw: 0.3 });
  p.push({ kind: "circle", x: ex[3], y: gy, r: 0.45, fill: note });
  p.push({ kind: "text", x: ex[3] + 3, y: gy + 0.8, text: "yanlış", size: 2.1, fill: note });

  if (per?.qr) {
    const side = 26;
    const x0 = 192 - side;
    drawQr(p, per.qr, x0, 49, side);
    p.push({ kind: "text", x: x0 + side / 2, y: 49 + side + 4, text: "Kişiye özel form", size: 2.4, fill: labelInk, anchor: "middle", bold: true });
    p.push({ kind: "text", x: x0 + side / 2, y: 49 + side + 7.4, text: "Başkasıyla değiştirmeyin", size: 2, fill: note, anchor: "middle" });
  }
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
