import { api, type Params } from "@/shared/http";
import { solutionImage } from "@/modules/exams/server";

/** Girişsiz çözüm sayfasındaki kesilmiş sorunun görseli (anahtar + yayın + soru denemede olmalı). */
export const GET = api<Params<{ token: string; itemId: string }>>(async (_req, ctx) => {
  const { token, itemId } = await ctx.params;
  const f = await solutionImage(token, itemId);
  return new Response(new Uint8Array(f.data), { headers: { "Content-Type": f.type, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
});
