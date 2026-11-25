import bcrypt from "bcryptjs";
import { prisma } from "@/shared/db";
import { conflict, forbidden, invalid, unauthorized } from "@/shared/errors";
import { allowRegistration } from "./config";
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
  if (!allowRegistration()) throw forbidden("Yeni hesap açma kapalı.");
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

/**
 * Yerel araçlar (MCP sunucusu) için kurum kimliği: e-posta verilirse o hesap; verilmezse veritabanında tek hesap varsa o.
 * Oturum / şifre sorulmaz: yalnızca veritabanının bulunduğu makinede çalışan süreçler kullanır.
 */
export async function resolveLocalOwner(email?: string) {
  const e = String(email ?? "").toLowerCase().trim();
  if (e) {
    const u = await prisma.user.findUnique({ where: { email: e }, select: { id: true, name: true } });
    if (!u) throw invalid(`${e} ile kayıtlı hesap yok.`);
    return u;
  }
  const users = await prisma.user.findMany({ select: { id: true, name: true }, take: 2 });
  if (users.length === 1) return users[0];
  throw invalid(users.length ? "Birden fazla kurum hesabı var; MCP_OWNER_EMAIL ile hangisi olduğunu belirtin." : "Veritabanında kurum hesabı yok.");
}
