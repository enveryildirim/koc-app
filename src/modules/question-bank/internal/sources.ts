import { prisma } from "@/shared/db";
import { invalid, notFound } from "@/shared/errors";
import { getFile, putFile, removeFiles, sniff } from "@/shared/storage";
import { LIMITS } from "../index";

export type UploadFile = { name: string; bytes: Uint8Array };

const keysOf = (files: string) => JSON.parse(files) as string[];

/**
 * Yeni kaynak: tek PDF ya da bir veya daha çok resim (her resim bir sayfa).
 * Tür, dosyanın ilk baytlarından belirlenir; PDF ile resim karıştırılamaz.
 */
export async function createSource(ownerId: string, name: string, files: UploadFile[]) {
  if (!files.length) throw invalid("En az bir dosya seçin.");
  const kinds = files.map((f) => sniff(f.bytes));
  if (kinds.some((k) => !k)) throw invalid("Yalnızca PDF, PNG, JPG ya da WEBP yükleyebilirsiniz.");
  const isPdf = kinds[0] === "pdf";
  if (isPdf && files.length > 1) throw invalid("PDF'ler tek tek yüklenir.");
  if (!isPdf && kinds.includes("pdf")) throw invalid("PDF ile resimler aynı kaynağa eklenemez.");
  const maxMB = isPdf ? LIMITS.sourceMB : LIMITS.imageMB;
  if (files.some((f) => f.bytes.length > maxMB * 1024 * 1024)) throw invalid(`Dosya en fazla ${maxMB} MB olabilir.`);
  if (files.length > 200) throw invalid("Bir kaynağa en fazla 200 resim eklenebilir.");

  const title = name.trim() || files[0].name.replace(/\.[^.]+$/, "") || "Adsız kaynak";
  const keys: string[] = [];
  try {
    for (let i = 0; i < files.length; i++) keys.push(await putFile(ownerId, kinds[i]!, files[i].bytes));
    const src = await prisma.questionSource.create({
      data: { ownerId, name: title.slice(0, 120), kind: isPdf ? "PDF" : "IMAGE", files: JSON.stringify(keys) },
    });
    return { id: src.id };
  } catch (e) {
    await removeFiles(ownerId, keys);
    throw e;
  }
}

/** Kurumun kaynakları, soru sayılarıyla (yeniden eskiye). */
export async function listSources(ownerId: string) {
  const rows = await prisma.questionSource.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return rows.map((s) => ({ id: s.id, name: s.name, kind: s.kind, pages: keysOf(s.files).length, createdAt: s.createdAt, questions: s._count.items }));
}

/** Kesme ekranı için kaynak ve bu kaynaktan önceden kesilmiş soruların kutuları. Yoksa null. */
export async function findSource(ownerId: string, id: string) {
  const s = await prisma.questionSource.findFirst({
    where: { id, ownerId },
    include: { items: { select: { id: true, page: true, crop: true, answer: true, topic: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    kind: s.kind as "PDF" | "IMAGE",
    files: keysOf(s.files).length,
    cut: s.items.filter((i) => i.page && i.crop).map((i) => ({ id: i.id, page: i.page!, crop: JSON.parse(i.crop), answer: i.answer, topic: i.topic })),
  };
}

/** Kaynağın n. dosyası (0 tabanlı). */
export async function sourceFile(ownerId: string, id: string, n: number) {
  const s = await prisma.questionSource.findFirst({ where: { id, ownerId } });
  const key = s ? keysOf(s.files)[n] : undefined;
  const f = key ? await getFile(ownerId, key) : null;
  if (!f) throw notFound("Dosya bulunamadı.");
  return f;
}

/** Kaynağı ve dosyalarını siler; kesilmiş sorular havuzda kalır (kaynak bağlantısı kopar). */
export async function deleteSource(ownerId: string, id: string) {
  const s = await prisma.questionSource.findFirst({ where: { id, ownerId } });
  if (!s) throw notFound("Kaynak bulunamadı.");
  await prisma.questionSource.delete({ where: { id: s.id } });
  await removeFiles(ownerId, keysOf(s.files));
}
