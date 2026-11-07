import { redirect } from "next/navigation";
import { unauthorized } from "@/shared/errors";
import { getSession, getUser, requireUser } from "./session";

/** Kurum sayfaları için: giriş zorunlu (kurum hesabı ya da etüt mesulü). Dönen değer kurumun kimliği (ownerId). */
export async function requireOwner() {
  const user = await requireUser();
  return user.id;
}

/** API rotaları için: kurum hesabı ya da etüt mesulü değilse null (öğretmen oturumu dahil). */
export async function apiOwner() {
  const user = await getUser();
  return user?.id ?? null;
}

/** API rotaları için: kurum hesabı ya da etüt mesulü değilse AppError("unauthorized"). `api()` ile birlikte kullanın. */
export async function ownerOrThrow() {
  const id = await apiOwner();
  if (!id) throw unauthorized();
  return id;
}

/**
 * İşlemi yapan kişi. OWNER: kurum hesabı; MENTOR: etüt mesulü (yönetici yetkisi); TEACHER: öğretmen.
 * Öğretmenin de kullanabildiği rotalar (yoklama, işlenen konu) bunu kullanır ve TEACHER için
 * kaydın o öğretmene ait olduğunu ilgili modül denetler.
 */
export type Actor = { ownerId: string; teacherId: string | null; role: "OWNER" | "MENTOR" | "TEACHER" };

export async function actorOrThrow(): Promise<Actor> {
  const s = await getSession();
  if (!s) throw unauthorized();
  if (!s.staff) return { ownerId: s.ownerId, teacherId: null, role: "OWNER" };
  return { ownerId: s.ownerId, teacherId: s.staff.teacherId, role: s.staff.role };
}

/** Öğretmen ekranı (/ogretmen) için: kişisel linkle girilmiş oturum. Kurum hesabı panele, girişsiz kullanıcı girişe gider. */
export async function requireStaff() {
  const s = await getSession();
  if (!s) redirect("/giris");
  if (!s.staff) redirect("/kurum");
  return { ownerId: s.ownerId, ...s.staff };
}
