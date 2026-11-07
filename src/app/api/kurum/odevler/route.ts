import { api } from "@/shared/http";
import { actorOrThrow } from "@/modules/identity/server";
import { createHomework } from "@/modules/homework/server";

/** Yeni ödev: sınıfın tüm öğrencileri (ek üyeler dahil) için PENDING durum kaydı. Öğretmen yalnızca kendi dersine. */
export const POST = api(async (req) => {
  const a = await actorOrThrow();
  return createHomework(a.ownerId, await req.json(), { teacherId: a.role === "TEACHER" ? a.teacherId! : undefined });
});
