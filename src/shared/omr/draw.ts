import { buildForm, computeLayout, FormSpec, PAGE_H, PAGE_W, Prim } from "./layout";

/** Primitifleri bir canvas'a mm → px ölçeğiyle çizer. */
export function drawPrims(ctx: CanvasRenderingContext2D, prims: Prim[], scale: number) {
  for (const p of prims) {
    ctx.save();
    if (p.kind === "rect") {
      ctx.beginPath();
      ctx.rect(p.x * scale, p.y * scale, p.w * scale, p.h * scale);
      if (p.fill) { ctx.fillStyle = p.fill; ctx.fill(); }
      if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = (p.sw ?? 0.3) * scale; ctx.stroke(); }
    } else if (p.kind === "circle") {
      ctx.beginPath();
      ctx.arc(p.x * scale, p.y * scale, p.r * scale, 0, Math.PI * 2);
      if (p.fill) { ctx.fillStyle = p.fill; ctx.fill(); }
      if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = (p.sw ?? 0.3) * scale; ctx.stroke(); }
    } else if (p.kind === "line") {
      ctx.beginPath();
      ctx.moveTo(p.x1 * scale, p.y1 * scale);
      ctx.lineTo(p.x2 * scale, p.y2 * scale);
      ctx.strokeStyle = p.stroke;
      ctx.lineWidth = p.sw * scale;
      ctx.stroke();
    } else {
      ctx.fillStyle = p.fill ?? "#000";
      ctx.font = `${p.bold ? "bold " : ""}${p.size * scale}px Arial, sans-serif`;
      ctx.textAlign = p.anchor === "middle" ? "center" : p.anchor === "end" ? "right" : "left";
      ctx.fillText(p.text, p.x * scale, p.y * scale);
    }
    ctx.restore();
  }
}

export type SampleFill = {
  /** Her soru için işaretlenen şık indeksleri (boş dizi = boş bırakılmış). */
  answers: number[][];
  studentNo: string;
  name: string;
  booklet?: string;
};

/**
 * Test amaçlı "taranmış" bir form görüntüsü üretir: formu çizer, baloncukları
 * kurşun kalem gibi doldurur, sonra hafif döndürüp gürültü ekler.
 */
export function renderSampleScan(info: FormSpec, fill: SampleFill): string {
  const L = computeLayout(info);
  const scale = 6; // ~150 dpi
  const page = document.createElement("canvas");
  page.width = PAGE_W * scale;
  page.height = PAGE_H * scale;
  const ctx = page.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, page.width, page.height);
  drawPrims(ctx, buildForm(info, L), scale);

  const pencil = (x: number, y: number, r = L.r) => {
    ctx.beginPath();
    ctx.arc(x * scale + jitter(0.6), y * scale + jitter(0.6), r * scale * (0.82 + Math.random() * 0.12), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(30,30,40,${0.82 + Math.random() * 0.15})`;
    ctx.fill();
  };

  // El yazısı ad
  ctx.font = `italic ${5 * scale}px "Comic Sans MS", cursive`;
  ctx.fillStyle = "#1e3a8a";
  ctx.fillText(fill.name, 24 * scale, 47 * scale);

  fill.studentNo.split("").forEach((d, c) => {
    const b = L.student[c][Number(d)];
    if (b) pencil(b.x, b.y, 2.2);
    ctx.font = `${3.6 * scale}px Arial`;
    ctx.fillStyle = "#1e3a8a";
    ctx.textAlign = "center";
    ctx.fillText(d, b.x * scale, (L.studentBox.y + 5) * scale);
    ctx.textAlign = "left";
  });
  fill.answers.forEach((choices, q) => {
    const bs = L.questions[q] ?? [];
    for (const k of choices) if (bs[k]) pencil(bs[k].x, bs[k].y);
  });
  const bk = L.booklet.find((b) => b.label === fill.booklet);
  if (bk) pencil(bk.x, bk.y, 2.2);

  // "Tarama": döndür, ölçekle, kağıt tonu ve gürültü ekle
  const out = document.createElement("canvas");
  out.width = 1240;
  out.height = 1754;
  const o = out.getContext("2d")!;
  o.fillStyle = "#cfcac0";
  o.fillRect(0, 0, out.width, out.height);
  o.translate(out.width / 2 + jitter(20), out.height / 2 + jitter(20));
  o.rotate(((Math.random() - 0.5) * 5 * Math.PI) / 180);
  const s = 0.92 + Math.random() * 0.04;
  o.scale((out.width / page.width) * s, (out.width / page.width) * s);
  o.drawImage(page, -page.width / 2, -page.height / 2);
  o.setTransform(1, 0, 0, 1, 0, 0);

  const img = o.getImageData(0, 0, out.width, out.height);
  const grad = (y: number) => 1 - 0.08 * (y / out.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const y = Math.floor(i / 4 / out.width);
    const n = (Math.random() - 0.5) * 22;
    const g = grad(y);
    img.data[i] = clamp(img.data[i] * g + n);
    img.data[i + 1] = clamp(img.data[i + 1] * g + n);
    img.data[i + 2] = clamp(img.data[i + 2] * g * 0.97 + n);
  }
  o.putImageData(img, 0, 0);
  return out.toDataURL("image/jpeg", 0.85);
}

const jitter = (n: number) => (Math.random() - 0.5) * n;
const clamp = (v: number) => Math.max(0, Math.min(255, v));
