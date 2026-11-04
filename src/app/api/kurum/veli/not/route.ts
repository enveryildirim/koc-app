import { ownerOrThrow } from "@/modules/identity/server";
import { saveParentNote } from "@/modules/reporting/server";
import { api } from "@/shared/http";

/** Veli karnesindeki öğretmen görüşünü kaydeder. body: { studentId, note } */
export const POST = api(async (req) => {
  const ownerId = await ownerOrThrow();
  const { studentId, note } = await req.json();
  await saveParentNote(ownerId, String(studentId ?? ""), String(note ?? ""));
  return { ok: true };
});
