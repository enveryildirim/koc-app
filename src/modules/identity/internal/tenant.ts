import { unauthorized } from "@/shared/errors";
import { getUser, requireUser } from "./session";

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

/** API rotaları için: giriş yoksa AppError("unauthorized") fırlatır. `api()` ile birlikte kullanın. */
export async function ownerOrThrow() {
  const id = await apiOwner();
  if (!id) throw unauthorized();
  return id;
}
