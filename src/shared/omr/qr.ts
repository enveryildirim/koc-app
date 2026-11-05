/** QR kod matrisi (kişisel optik formda basılır). `qrcode` paketi tarayıcıda da sunucuda da çalışır. */
import QRCode from "qrcode";

export type QrMatrix = { size: number; data: number[] };

export function qrMatrix(text: string): QrMatrix {
  const m = QRCode.create(text, { errorCorrectionLevel: "M" }).modules;
  return { size: m.size, data: Array.from(m.data) };
}
