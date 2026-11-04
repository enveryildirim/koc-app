import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { createHomework } from "@/modules/homework/server";

/** Yeni ödev: sınıfın tüm öğrencileri için PENDING durum kaydı oluşturur. */
export const POST = api(async (req) => {
  const ownerId = await ownerOrThrow();
  return createHomework(ownerId, await req.json());
});
