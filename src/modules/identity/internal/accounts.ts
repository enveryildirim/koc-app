import bcrypt from "bcryptjs";
import { prisma } from "@/shared/db";
import { conflict, invalid, unauthorized } from "@/shared/errors";
import { createSession } from "./session";

/** E-posta + şifre ile giriş yapar ve oturum çerezini yazar. */
export async function login(body: Record<string, unknown>) {
  const user = await prisma.user.findUnique({ where: { email: String(body.email ?? "").toLowerCase().trim() } });
  if (!user || !(await bcrypt.compare(String(body.password ?? ""), user.passwordHash))) {
    throw unauthorized("E-posta veya şifre hatalı.");
  }
  await createSession(user.id);
}

/** Yeni hesap (kurum) açar ve oturum çerezini yazar. */
export async function register(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw invalid("Ad ve geçerli bir e-posta girin.");
  if (password.length < 6) throw invalid("Şifre en az 6 karakter olmalı.");
  if (await prisma.user.findUnique({ where: { email } })) throw conflict("Bu e-posta ile kayıtlı bir hesap var.");
  const user = await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10) } });
  await createSession(user.id);
}

/** Kurumun görünen adı (karnelerde başlık olarak kullanılır). */
export async function institutionName(ownerId: string) {
  const u = await prisma.user.findUnique({ where: { id: ownerId }, select: { name: true } });
  return u?.name ?? "";
}
