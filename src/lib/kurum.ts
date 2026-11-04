import { prisma } from "./db";
import { getUser, requireUser } from "./auth";

/** Kurum sayfaları için: giriş zorunlu, kullanıcı kimliği = kurum sahibi (ownerId). */
export async function requireOwner() {
  const user = await requireUser();
  return user.id;
}

/** API rotaları için: giriş yoksa null. */
export async function apiOwner() {
  const user = await getUser();
  return user?.id ?? null;
}

export const fullName = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`;

export async function classroomsOf(ownerId: string) {
  return prisma.classroom.findMany({ where: { ownerId }, orderBy: { name: "asc" } });
}

export { DAYS, LESSON_TYPES, ATTENDANCE, HOMEWORK } from "./kurumLabels";

/** Yerel saat diliminde YYYY-MM-DD */
export function ymd(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** YYYY-MM-DD için 1 = Pazartesi … 7 = Pazar */
export function dayOfWeek(date: string) {
  const d = new Date(date + "T12:00:00");
  return ((d.getDay() + 6) % 7) + 1;
}
