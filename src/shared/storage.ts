import "server-only";
import { randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

/**
 * Kurum dosyaları için basit disk deposu: STORAGE_DIR/<ownerId>/<anahtar>.
 * Anahtarı her zaman depo üretir; dışarıdan gelen anahtar yalnızca biçimi doğrulanınca kullanılır.
 * Bulut depoya (S3/R2) geçişte yalnızca bu dosya değişir.
 */
const ROOT = path.resolve(process.env.STORAGE_DIR ?? "storage");
const SAFE_OWNER = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_KEY = /^[a-z0-9-]{36}\.(pdf|png|jpg|webp)$/;

export type FileKind = "pdf" | "png" | "jpg" | "webp";

export const MIME: Record<FileKind, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/** Dosya türünü uzantıya ya da istemcinin bildirdiği MIME'a değil, ilk baytlara bakarak belirler. */
export function sniff(b: Uint8Array): FileKind | null {
  const at = (i: number, s: string) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (at(0, "%PDF")) return "pdf";
  if (b[0] === 0x89 && at(1, "PNG")) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (at(0, "RIFF") && at(8, "WEBP")) return "webp";
  return null;
}

function fileOf(ownerId: string, key: string) {
  if (!SAFE_OWNER.test(ownerId) || !SAFE_KEY.test(key)) throw new Error("Geçersiz dosya anahtarı.");
  return path.join(ROOT, ownerId, key);
}

export async function putFile(ownerId: string, kind: FileKind, data: Uint8Array) {
  const key = `${randomUUID()}.${kind}`;
  const file = fileOf(ownerId, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  return key;
}

/** Dosya içeriği ve türü; dosya yoksa null. */
export async function getFile(ownerId: string, key: string) {
  try {
    const data = await readFile(fileOf(ownerId, key));
    return { data, type: MIME[key.split(".").pop() as FileKind] };
  } catch {
    return null;
  }
}

export async function removeFiles(ownerId: string, keys: string[]) {
  await Promise.all(keys.filter(Boolean).map((k) => rm(fileOf(ownerId, k), { force: true }).catch(() => {})));
}
