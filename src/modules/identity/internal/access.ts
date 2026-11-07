import { randomBytes } from "crypto";
import { prisma } from "@/shared/db";
import { createStaffSession } from "./session";

/*
 * Kişisel giriş linkleri (öğretmen / etüt mesulü). Link, sahibinin anahtarıdır: şifre yoktur.
 * Öğretmen kaydı schedule modülündedir; ad ve rol buraya schedule tarafından eşitlenir (`syncAccessLink`).
 */

type Person = { id: string; name: string; role: string };

const newToken = () => randomBytes(18).toString("base64url");

/** Linki oluşturur ya da yeniler. Yenilenince eski linkle açılmış oturumlar kapanır. Yeni anahtarı döndürür. */
export async function issueAccessLink(ownerId: string, t: Person) {
  await prisma.accessLink.deleteMany({ where: { ownerId, teacherId: t.id } });
  const link = await prisma.accessLink.create({ data: { ownerId, teacherId: t.id, name: t.name, role: t.role, token: newToken() } });
  return link.token;
}

/** Linki kaldırır; bu linkle açılmış oturumlar da kapanır. */
export async function revokeAccessLink(ownerId: string, teacherId: string) {
  await prisma.accessLink.deleteMany({ where: { ownerId, teacherId } });
}

/** Öğretmenin adı ya da rolü değişince linkteki bilgiyi günceller (link varsa). */
export async function syncAccessLink(ownerId: string, t: Person) {
  await prisma.accessLink.updateMany({ where: { ownerId, teacherId: t.id }, data: { name: t.name, role: t.role } });
}

/** Kurumun linkleri, öğretmen kimliğine göre. */
export async function accessLinksOf(ownerId: string) {
  const list = await prisma.accessLink.findMany({ where: { ownerId }, select: { teacherId: true, token: true, createdAt: true, lastUsedAt: true } });
  return new Map(list.map((l) => [l.teacherId, l]));
}

/** Herkese açık: linkle giriş. Geçerliyse oturum açar ve rolü döndürür; değilse null. */
export async function signInWithAccessLink(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const link = await prisma.accessLink.findUnique({ where: { token } });
  if (!link) return null;
  await prisma.accessLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } });
  await createStaffSession(link.ownerId, link.id);
  return link.role;
}
