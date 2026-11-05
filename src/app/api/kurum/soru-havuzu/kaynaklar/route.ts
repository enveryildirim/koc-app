import { api } from "@/shared/http";
import { invalid } from "@/shared/errors";
import { ownerOrThrow } from "@/modules/identity/server";
import { createSource } from "@/modules/question-bank/server";

/** Yeni kaynak (multipart): name + files[] (tek PDF ya da resimler). */
export const POST = api(async (req) => {
  const ownerId = await ownerOrThrow();
  const form = await req.formData().catch(() => {
    throw invalid("Geçersiz istek.");
  });
  const files = await Promise.all(
    form.getAll("files").filter((f): f is File => f instanceof File).map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
  );
  return createSource(ownerId, String(form.get("name") ?? ""), files);
});
