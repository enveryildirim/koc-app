import { api } from "@/shared/http";
import { invalid } from "@/shared/errors";
import { ownerOrThrow } from "@/modules/identity/server";
import { createItems, deleteItems, updateItems } from "@/modules/question-bank/server";

/** Kesilen soruları kaydet (multipart): sourceId?, meta (JSON dizi), images[] (aynı sırayla). */
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
  const images = await Promise.all(
    form.getAll("images").filter((f): f is File => f instanceof File).map(async (f) => new Uint8Array(await f.arrayBuffer())),
  );
  return createItems(ownerId, String(form.get("sourceId") ?? "") || null, metas, images);
});

/** Toplu düzenleme: { ids, set: { subject?, topic?, grade?, difficulty?, answer? } } */
export const PATCH = api(async (req) => {
  const body = await req.json();
  return updateItems(await ownerOrThrow(), body.ids, body.set);
});

/** Toplu silme: { ids } */
export const DELETE = api(async (req) => {
  const body = await req.json();
  return deleteItems(await ownerOrThrow(), body.ids);
});
