import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { createExamFromBank } from "@/modules/exams/server";

/** Soru havuzundan deneme: { name, type, date, booklets (1–4), sections: [{ name, items }] } */
export const POST = api(async (req) => {
  const ownerId = await ownerOrThrow();
  return createExamFromBank(ownerId, await req.json());
});
