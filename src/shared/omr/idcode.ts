/**
 * Kişisel optik formun kimlik şeridi: 32 bit = 20 bit öğrenci numarası + 4 bit sürüm + 8 bit sağlama.
 * Bitler soldan sağa, en anlamlı bit önce. Sağlama CRC-8 (0x07) XOR 0xA5'tir; böylece hiç
 * işaretlenmemiş (boş) bir şerit geçerli sayılmaz.
 */
export const ID_BITS = 32;
const VERSION = 1;
const MAX_NO = (1 << 20) - 1;

function crc8(bytes: number[]) {
  let c = 0;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c ^ 0xa5;
}

const toBytes = (v24: number) => [(v24 >> 16) & 0xff, (v24 >> 8) & 0xff, v24 & 0xff];

/** Öğrenci numarasını (yalnızca rakamlar; baştaki sıfırlar anlamsız) 32 bitlik diziye çevirir. */
export function encodeStudentId(studentNo: string): boolean[] {
  const n = Number(studentNo.replace(/\D/g, "") || "0");
  if (!Number.isInteger(n) || n < 0 || n > MAX_NO) throw new Error(`Öğrenci numarası kimlik şeridine sığmıyor: ${studentNo}`);
  const v24 = (n << 4) | VERSION;
  const word = v24 * 256 + crc8(toBytes(v24));
  return Array.from({ length: ID_BITS }, (_, i) => Math.floor(word / 2 ** (ID_BITS - 1 - i)) % 2 === 1);
}

/** Okunan bitlerden öğrenci numarası; sağlama ya da sürüm tutmazsa null. */
export function decodeStudentId(bits: boolean[]): string | null {
  if (bits.length !== ID_BITS) return null;
  let word = 0;
  for (const b of bits) word = word * 2 + (b ? 1 : 0);
  const v24 = Math.floor(word / 256);
  const check = word % 256;
  if (crc8(toBytes(v24)) !== check || (v24 & 0xf) !== VERSION) return null;
  return String(v24 >> 4);
}
