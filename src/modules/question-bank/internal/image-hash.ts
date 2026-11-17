import sharp from "sharp";

/**
 * Kesilmiş sorunun görsel parmak izi (dHash, 16×16 = 256 bit, 64 hex). Beyaz kenarlar kırpılır (trim), gri tonlamada
 * yan yana piksellerin parlaklık farkının yönü kaydedilir. Aynı görselin yeniden kesilmesi (kenar farkı, JPEG, ölçek)
 * yakın parmak izi verir; farklı sorular uzak düşer.
 *
 * Ölçüm (dev.db, 17 Kasım 2026, 53 görsel): aynı görselin kenar eklenmiş / sıkı kırpılmış / JPEG / 2 kat hâlleri ≤ 0,09;
 * farklı görsellerin en yakın %5'i ≥ 0,33. Eşik 0,12. Yarı çözünürlük 0,20'ye çıkabilir (kesme ekranı aynı PDF'i aynı
 * ölçekte çizdiği için pratikte olmaz). Şekli aynı ama metni farklı sorular (ör. aynı birim çember) çok yakın çıkar:
 * yalnızca tamamen görsel olan (kesilmiş) sorularda kullanılır, yazılan sorunun şeklinde kullanılmaz.
 */
const W = 16;
const H = 16;
export const IMAGE_SAME = 0.12;

export async function imageHash(bytes: Uint8Array): Promise<string> {
  try {
    const data = await sharp(bytes)
      .flatten({ background: "#ffffff" })
      .greyscale()
      .trim({ threshold: 20 })
      .resize(W + 1, H, { fit: "fill" })
      .raw()
      .toBuffer();
    let hex = "";
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x += 4) {
        let nib = 0;
        for (let k = 0; k < 4; k++) nib = (nib << 1) | (data[y * (W + 1) + x + k] > data[y * (W + 1) + x + k + 1] ? 1 : 0);
        hex += nib.toString(16);
      }
    }
    return hex;
  } catch {
    // Boş / tek renkli görselde trim hata verebilir: parmak izi yok
    return "";
  }
}

const POP = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** İki parmak izinin farkı (0–1); biri yoksa 1. */
export function hashDistance(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return 1;
  let n = 0;
  for (let i = 0; i < a.length; i++) n += POP[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return n / (a.length * 4);
}
