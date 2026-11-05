/**
 * Sezgisel soru bulma (istemci + sunucu güvenli, dış servis yok).
 *
 * Sayfa görüntüsünde mürekkep izdüşümüne bakar:
 *  1. Uzun dikey çizgileri (sütun ayırıcı) siler, ortadaki boş şeritten iki sütunlu düzeni bulur.
 *  2. Her sütunda yatay izdüşümle metin satırlarını çıkarır; uzun yatay çizgiler zorunlu soru sınırıdır.
 *  3. Satırlar arası boşluk medyandan belirgin büyükse VE sonraki satır sütunun sol kenarından başlıyorsa
 *     (soru numarası) orada yeni soru başlar. İçeride ya da ortada başlayan bloklar (şık, şekil) önceki soruya katılır.
 *  4. Sayfa numarası, üst / alt bilgi gibi küçük blokları eler.
 *
 * Çıktı sayfaya göre 0–1 oranlı kutulardır; yapay zekâ dedektörü de aynı DetectedBox tipini döndürür.
 */
import type { DetectedBox, ImageLike } from "./types";

export type DetectOptions = {
  /** 1 (az böl) … 5 (çok böl). Varsayılan 3. */
  sensitivity?: number;
};

const SPLIT_FACTOR = [0, 3.4, 2.7, 2.1, 1.7, 1.35];

export function detectQuestions(img: ImageLike, opts: DetectOptions = {}): DetectedBox[] {
  const { width: W, height: H, data } = img;
  if (W < 50 || H < 50) return [];
  const k = SPLIT_FACTOR[Math.min(5, Math.max(1, Math.round(opts.sensitivity ?? 3)))];

  // Koyu piksel maskesi.
  const ink = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < ink.length; i++, p += 4) {
    const lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    ink[i] = data[p + 3] > 0 && lum < 170 ? 1 : 0;
  }

  // 1. Uzun dikey çizgileri sil (sütun ayırıcı, kenar çerçevesi).
  const colInk = new Uint32Array(W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) colInk[x] += ink[y * W + x];
  for (let x = 0; x < W; x++) {
    if (colInk[x] > H * 0.45) {
      for (let y = 0; y < H; y++) ink[y * W + x] = 0;
      colInk[x] = 0;
    }
  }

  // Ortadaki boş şerit = iki sütun. Üst / alt bilgiyi saymamak için orta bant kullanılır.
  const y0 = Math.floor(H * 0.08);
  const y1 = Math.ceil(H * 0.92);
  const band = new Uint32Array(W);
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) band[x] += ink[y * W + x];
  const empty = (x: number) => band[x] <= (y1 - y0) * 0.002;
  let best: [number, number] | null = null;
  for (let x = Math.floor(W * 0.3); x < W * 0.7; ) {
    if (!empty(x)) {
      x++;
      continue;
    }
    const s = x;
    while (x < W * 0.7 && empty(x)) x++;
    if (x - s >= W * 0.012 && (!best || x - s > best[1] - best[0])) best = [s, x];
  }
  // Sütunun iki yanında da içerik olmalı; yoksa tek sütun.
  const hasInk = (a: number, b: number) => {
    let n = 0;
    for (let x = a; x < b; x++) n += band[x];
    return n > (b - a) * (y1 - y0) * 0.004;
  };
  const columns: [number, number][] =
    best && hasInk(0, best[0]) && hasInk(best[1], W) ? [[0, best[0]], [best[1], W]] : [[0, W]];

  const boxes: DetectedBox[] = [];
  const needMargin = (opts.sensitivity ?? 3) < 5;
  for (const [cx0, cx1] of columns) boxes.push(...columnBlocks(ink, W, H, cx0, cx1, k, needMargin));
  return boxes;
}

function columnBlocks(ink: Uint8Array, W: number, H: number, cx0: number, cx1: number, k: number, needMargin: boolean): DetectedBox[] {
  const cw = cx1 - cx0;
  const rowInk = new Uint32Array(H);
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = cx0; x < cx1; x++) n += ink[y * W + x];
    rowInk[y] = n;
  }

  // Uzun ve ince yatay çizgi = ayırıcı. Kalın yoğun bantlar (şekil, gölgeli kutu) içeriktir.
  const ruleMax = Math.max(3, Math.round(H * 0.003));
  const isRule = new Uint8Array(H);
  for (let y = 0; y < H; ) {
    if (rowInk[y] <= cw * 0.55) {
      y++;
      continue;
    }
    const a = y;
    while (y < H && rowInk[y] > cw * 0.55) y++;
    if (y - a <= ruleMax) isRule.fill(1, a, y);
  }

  // Satırları çıkar.
  type Line = { a: number; b: number; left: number; ruleBefore: boolean };
  const lines: Line[] = [];
  const minInk = Math.max(2, cw * 0.002);
  let ruleSeen = false;
  for (let y = 0; y < H; ) {
    if (isRule[y]) {
      ruleSeen = true;
      y++;
      continue;
    }
    if (rowInk[y] < minInk) {
      y++;
      continue;
    }
    const a = y;
    while (y < H && rowInk[y] >= minInk && !isRule[y]) y++;
    let left = cx1;
    for (let yy = a; yy < y; yy++) {
      for (let x = cx0; x < left; x++) {
        if (ink[yy * W + x]) {
          left = x;
          break;
        }
      }
    }
    lines.push({ a, b: y, left, ruleBefore: ruleSeen });
    ruleSeen = false;
  }
  if (!lines.length) return [];

  // Boşluk eşiği: satır aralığı medyanının k katı (en az sayfanın %1,2'si).
  const gaps = lines.slice(1).map((l, i) => l.a - lines[i].b);
  const sorted = [...gaps].sort((p, q) => p - q);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const threshold = Math.max(median * k, H * 0.012);

  // Sütunun sol kenarı: satır başlarının alt yüzdeliği (tek tük taşan satırdan etkilenmesin).
  const lefts = lines.map((l) => l.left).sort((p, q) => p - q);
  const margin = lefts[Math.floor(lefts.length * 0.1)];
  const atMargin = (l: Line) => !needMargin || l.left <= margin + W * 0.012;

  const groups: Line[][] = [[lines[0]]];
  lines.slice(1).forEach((l, i) => {
    if (l.ruleBefore || (gaps[i] > threshold && atMargin(l))) groups.push([l]);
    else groups[groups.length - 1].push(l);
  });

  const pad = Math.round(H * 0.006);
  const out: DetectedBox[] = [];
  for (const g of groups) {
    const top = g[0].a;
    const bottom = g[g.length - 1].b;
    let left = cx1;
    let right = cx0;
    for (let y = top; y < bottom; y++) {
      for (let x = cx0; x < cx1; x++) {
        if (ink[y * W + x]) {
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }
    const h = bottom - top;
    const w = right - left;
    if (w <= 0) continue;
    // Sayfa numarası, kısa üst / alt bilgi gibi küçük blokları ele.
    if (h < H * 0.02 && w < cw * 0.5) continue;
    if ((bottom < H * 0.07 || top > H * 0.93) && h < H * 0.035) continue;
    const x = Math.max(0, left - pad);
    const y = Math.max(0, top - pad);
    out.push({
      x: x / W,
      y: y / H,
      w: (Math.min(W, right + pad) - x) / W,
      h: (Math.min(H, bottom + pad) - y) / H,
    });
  }
  return out;
}
