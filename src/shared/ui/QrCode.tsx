import { qrMatrix } from "@/shared/omr/qr";

/** Yazdırılabilir QR kod (SVG, siyah-beyaz). `size` CSS boyutu (ör. "22mm"). Sessiz bölge için 2 modül boşluk bırakılır. */
export default function QrCode({ text, size, title }: { text: string; size: string; title?: string }) {
  const { size: n, data } = qrMatrix(text);
  const pad = 2;
  let d = "";
  data.forEach((v, i) => {
    if (v) d += `M${(i % n) + pad} ${Math.floor(i / n) + pad}h1v1h-1z`;
  });
  return (
    <svg viewBox={`0 0 ${n + pad * 2} ${n + pad * 2}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label={title ?? "QR kod"} className="block shrink-0">
      <rect width="100%" height="100%" fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
