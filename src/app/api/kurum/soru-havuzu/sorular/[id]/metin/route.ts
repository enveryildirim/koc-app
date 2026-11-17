import { api, type Params } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { setTranscripts } from "@/modules/question-bank/server";

/** Kesilmiş sorunun metni (öğretmen yazar): { stem, options? }. Boş kök metni siler. Arama ve benzerlik içindir. */
export const PUT = api<Params<{ id: string }>>(async (req, ctx) => {
  const body = await req.json().catch(() => ({}));
  return setTranscripts(await ownerOrThrow(), [{ id: (await ctx.params).id, stem: body.stem, options: body.options }], "MANUAL");
});
