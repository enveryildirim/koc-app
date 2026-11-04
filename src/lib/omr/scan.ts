/**
 * Optik form tarayıcı (saf TypeScript, bağımlılıksız).
 *
 * 1. Gri tonlama + uyarlamalı eşikleme (gölgeli fotoğraflara dayanıklı)
 * 2. Bağlı bileşen analizi ile 4 köşe karesini bulma
 * 3. Form (mm) → görüntü (px) homografisi
 * 4. Her baloncukta koyu piksel oranını ölçme
 */
import { BUBBLE_R, FormQuestion, MARKERS, questionBubbles, STUDENT_DIGITS, studentBubbles } from "./layout";

export type ImageLike = { data: Uint8ClampedArray; width: number; height: number };

export type BubbleState = { x: number; y: number; r: number; fill: number; marked: boolean };

export type QuestionRead = {
  /** İşaretlenen şık indeksleri */
  marked: number[];
  status: "ok" | "blank" | "multiple" | "uncertain";
  bubbles: BubbleState[];
};

export type ScanResult = {
  markers: [number, number][];
  studentNo: string;
  studentBubbles: BubbleState[];
  questions: QuestionRead[];
};

const MARK_T = 0.45;
const UNSURE_T = 0.25;

export function scanForm(img: ImageLike, questions: FormQuestion[]): ScanResult {
  const { width: W, height: H } = img;
  const dark = binarize(img);
  const markers = findMarkers(dark, W, H);
  const h = homography(MARKERS, markers);
  const project = (x: number, y: number) => applyH(h, x, y);
  const pxPerMm = Math.hypot(markers[1][0] - markers[0][0], markers[1][1] - markers[0][1]) / (MARKERS[1][0] - MARKERS[0][0]);

  const measure = (bx: number, by: number): BubbleState => {
    let hit = 0;
    let total = 0;
    const rr = BUBBLE_R * 0.62;
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const dx = (i / (steps - 1) - 0.5) * 2 * rr;
        const dy = (j / (steps - 1) - 0.5) * 2 * rr;
        if (dx * dx + dy * dy > rr * rr) continue;
        const [px, py] = project(bx + dx, by + dy);
        const ix = Math.round(px);
        const iy = Math.round(py);
        total++;
        if (ix >= 0 && iy >= 0 && ix < W && iy < H && dark[iy * W + ix]) hit++;
      }
    }
    const [cx, cy] = project(bx, by);
    const fill = total ? hit / total : 0;
    return { x: cx, y: cy, r: BUBBLE_R * pxPerMm, fill, marked: fill >= MARK_T };
  };

  const qReads: QuestionRead[] = questions.map((q, i) => {
    const bubbles = questionBubbles(i)
      .slice(0, q.choiceCount)
      .map((b) => measure(b.x, b.y));
    const marked = bubbles.flatMap((b, k) => (b.marked ? [k] : []));
    const maxFill = Math.max(0, ...bubbles.map((b) => b.fill));
    let status: QuestionRead["status"] = "ok";
    if (marked.length > 1) status = "multiple";
    else if (marked.length === 0) status = maxFill >= UNSURE_T ? "uncertain" : "blank";
    return { marked, status, bubbles };
  });

  let studentNo = "";
  const sBubbles: BubbleState[] = [];
  for (let c = 0; c < STUDENT_DIGITS; c++) {
    const col = studentBubbles(c).map((b) => measure(b.x, b.y));
    sBubbles.push(...col);
    let best = -1;
    col.forEach((b, d) => {
      if (b.marked && (best < 0 || b.fill > col[best].fill)) best = d;
    });
    studentNo += best >= 0 ? String(best) : "";
  }

  return { markers, studentNo, studentBubbles: sBubbles, questions: qReads };
}

/* --------------------------------- Eşikleme --------------------------------- */

function binarize(img: ImageLike): Uint8Array {
  const { data, width: W, height: H } = img;
  const gray = new Float64Array(W * H);
  for (let i = 0, p = 0; p < W * H; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  // İntegral görüntü ile yerel ortalama
  const integ = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += gray[y * W + x];
      integ[(y + 1) * (W + 1) + x + 1] = integ[y * (W + 1) + x + 1] + row;
    }
  }
  const half = Math.max(8, Math.round(W / 16));
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(H, y + half + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(W, x + half + 1);
      const sum =
        integ[y1 * (W + 1) + x1] - integ[y0 * (W + 1) + x1] - integ[y1 * (W + 1) + x0] + integ[y0 * (W + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const g = gray[y * W + x];
      out[y * W + x] = g < mean * 0.72 && g < 150 ? 1 : 0;
    }
  }
  return out;
}

/* ------------------------------ Köşe işaretleri ------------------------------ */

type Blob = { area: number; cx: number; cy: number; minX: number; maxX: number; minY: number; maxY: number };

function findMarkers(dark: Uint8Array, W: number, H: number): [number, number][] {
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  const blobs: Blob[] = [];
  const minArea = W * H * 0.0002;
  for (let start = 0; start < W * H; start++) {
    if (!dark[start] || seen[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    const b: Blob = { area: 0, cx: 0, cy: 0, minX: W, maxX: 0, minY: H, maxY: 0 };
    while (sp) {
      const p = stack[--sp];
      const x = p % W;
      const y = (p - x) / W;
      b.area++;
      b.cx += x;
      b.cy += y;
      if (x < b.minX) b.minX = x;
      if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y;
      if (y > b.maxY) b.maxY = y;
      if (x > 0 && dark[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < W - 1 && dark[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && dark[p - W] && !seen[p - W]) { seen[p - W] = 1; stack[sp++] = p - W; }
      if (y < H - 1 && dark[p + W] && !seen[p + W]) { seen[p + W] = 1; stack[sp++] = p + W; }
    }
    if (b.area < minArea) continue;
    const bw = b.maxX - b.minX + 1;
    const bh = b.maxY - b.minY + 1;
    const aspect = bw / bh;
    const fill = b.area / (bw * bh);
    if (aspect < 0.7 || aspect > 1.4 || fill < 0.8) continue;
    b.cx /= b.area;
    b.cy /= b.area;
    blobs.push(b);
  }
  if (blobs.length < 4) {
    throw new Error("Köşe işaretleri bulunamadı. Formun dört köşesindeki siyah karelerin görüntüde net göründüğünden emin olun.");
  }
  // En büyük kare bloblar köşe işaretleridir; dolu baloncuklar bunlardan çok küçüktür.
  const maxArea = Math.max(...blobs.map((b) => b.area));
  const cands = blobs.filter((b) => b.area >= maxArea * 0.4);
  const corners: [number, number][] = [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ];
  const used = new Set<Blob>();
  const result = corners.map(([x, y]) => {
    let best: Blob | null = null;
    let bd = Infinity;
    for (const b of cands) {
      if (used.has(b)) continue;
      const d = Math.hypot(b.cx - x, b.cy - y);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) throw new Error("Dört köşe işaretinin tamamı bulunamadı.");
    used.add(best);
    return [best.cx, best.cy] as [number, number];
  });
  return result;
}

/* -------------------------------- Homografi -------------------------------- */

function homography(src: [number, number][], dst: [number, number][]): number[] {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const n = 8;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  const h = A.map((row, i) => row[n] / row[i]);
  return [...h, 1];
}

function applyH(h: number[], x: number, y: number): [number, number] {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}
