import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { setReaderFormat } from "@/modules/exams/server";

/** Optik okuyucu (FMT) TXT biçimi. Gövde: { format: ReaderFormat } ya da { format: null } (varsayılan). */
export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  await setReaderFormat(await ownerOrThrow(), (await ctx.params).id, await req.json());
});
