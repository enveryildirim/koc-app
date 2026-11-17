import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { similarForItem } from "@/modules/question-bank/server";

/** Sorunun havuzdaki benzerleri (Aynı soru / Benzer soru): soru ayrıntısı paneli. */
export const GET = api<Params<{ id: string }>>(async (_req, ctx) => ({ similar: await similarForItem(await ownerOrThrow(), (await ctx.params).id) }));
