import { api, type Params } from "@/shared/http";
import { invalid } from "@/shared/errors";
import { ownerOrThrow } from "@/modules/identity/server";
import { updateWrittenItem } from "@/modules/question-bank/server";

/** Yazılan soruyu güncelle (multipart): meta = JSON (WrittenMeta), image = yeni görsel, removeImage = "1" görseli kaldırır. */
export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const ownerId = await ownerOrThrow();
  const form = await req.formData().catch(() => {
    throw invalid("Geçersiz istek.");
  });
  let meta: unknown;
  try {
    meta = JSON.parse(String(form.get("meta") ?? "{}"));
  } catch {
    throw invalid("Geçersiz soru bilgisi.");
  }
  const f = form.get("image");
  const image = f instanceof File && f.size ? new Uint8Array(await f.arrayBuffer()) : form.get("removeImage") === "1" ? ("remove" as const) : undefined;
  return updateWrittenItem(ownerId, (await ctx.params).id, meta, image);
});
