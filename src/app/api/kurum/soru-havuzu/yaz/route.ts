import { api } from "@/shared/http";
import { invalid } from "@/shared/errors";
import { ownerOrThrow } from "@/modules/identity/server";
import { createWrittenItems } from "@/modules/question-bank/server";

/**
 * Elle yazılan / yapıştırılıp bölünen soruları kaydet (multipart):
 * meta = JSON dizi (WrittenMeta), image_<i> = i. sorunun isteğe bağlı görseli,
 * confirm = "1": havuzda aynısı olan soruyu yine de kaydet (ilk denemede 409 + confirm döner).
 */
export const POST = api(async (req) => {
  const ownerId = await ownerOrThrow();
  const form = await req.formData().catch(() => {
    throw invalid("Geçersiz istek.");
  });
  let metas: unknown;
  try {
    metas = JSON.parse(String(form.get("meta") ?? "[]"));
  } catch {
    throw invalid("Geçersiz soru bilgisi.");
  }
  const n = Array.isArray(metas) ? metas.length : 0;
  const images = await Promise.all(
    Array.from({ length: n }, async (_, i) => {
      const f = form.get(`image_${i}`);
      return f instanceof File && f.size ? new Uint8Array(await f.arrayBuffer()) : null;
    }),
  );
  return createWrittenItems(ownerId, metas, images, { allowSimilar: form.get("confirm") === "1" });
});
