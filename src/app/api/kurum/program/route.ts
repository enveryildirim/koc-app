import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { createSlot } from "@/modules/schedule/server";

export const POST = api(async (req) => {
  const slot = await createSlot(await ownerOrThrow(), await req.json());
  return { id: slot.id };
});
