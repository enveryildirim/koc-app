import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/db";

const COOKIE = "sk_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret");

/** Kişisel linkle giren öğretmen ya da etüt mesulü. */
export type Staff = { teacherId: string; name: string; role: "TEACHER" | "MENTOR"; linkId: string };

/**
 * Oturum: kurum hesabı (e-posta + şifre) ya da kişisel linkle giren personel.
 * `ownerId` her iki durumda da kurumun kimliğidir. Personel oturumu, linki silinince / yenilenince geçersizleşir.
 */
export type Session = { ownerId: string; staff: Staff | null };

async function sign(payload: Record<string, string>, sub: string) {
  const token = await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setIssuedAt().setExpirationTime("30d").sign(secret);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function createSession(userId: string) {
  await sign({}, userId);
}

/** Personel oturumu: sub = kurum, lid = kişisel link. */
export async function createStaffSession(ownerId: string, linkId: string) {
  await sign({ lid: linkId }, ownerId);
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Geçerli oturum; yoksa ya da geçersizse null. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    if (typeof payload.lid !== "string") return { ownerId: payload.sub, staff: null };
    const link = await prisma.accessLink.findFirst({ where: { id: payload.lid, ownerId: payload.sub } });
    if (!link) return null;
    return {
      ownerId: link.ownerId,
      staff: { teacherId: link.teacherId, name: link.name, role: link.role === "MENTOR" ? "MENTOR" : "TEACHER", linkId: link.id },
    };
  } catch {
    return null;
  }
}

/**
 * Kurum paneline girebilen kullanıcı: kurum hesabı ya da etüt mesulü (yönetici yetkisi).
 * Öğretmen oturumunda null. `staff`: etüt mesulüyse adı (panelde gösterilir).
 */
export async function getUser() {
  const s = await getSession();
  if (!s || s.staff?.role === "TEACHER") return null;
  const user = await prisma.user.findUnique({ where: { id: s.ownerId }, select: { id: true, name: true, email: true } });
  return user ? { ...user, staff: s.staff } : null;
}

/** Kurum paneli sayfaları için: öğretmen kendi ekranına, girişsiz kullanıcı giriş sayfasına yönlendirilir. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect((await getSession())?.staff ? "/ogretmen" : "/giris");
  return user;
}
