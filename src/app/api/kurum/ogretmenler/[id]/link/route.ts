import { api, type Params } from "@/shared/http";
import { notFound } from "@/shared/errors";
import { issueAccessLink, ownerOrThrow, revokeAccessLink } from "@/modules/identity/server";
import { findTeacher } from "@/modules/schedule/server";

/** Kişisel giriş linki oluşturur ya da yeniler (eski link ve oturumları geçersiz olur). Dönen: { token } */
export const POST = api<Params<{ id: string }>>(async (_req, ctx) => {
  const ownerId = await ownerOrThrow();
  const t = await findTeacher(ownerId, (await ctx.params).id);
  if (!t) throw notFound();
  return { token: await issueAccessLink(ownerId, t) };
});

/** Linki kaldırır; bu linkle açılmış oturumlar kapanır. */
export const DELETE = api<Params<{ id: string }>>(async (_req, ctx) => {
  const ownerId = await ownerOrThrow();
  const t = await findTeacher(ownerId, (await ctx.params).id);
  if (!t) throw notFound();
  await revokeAccessLink(ownerId, t.id);
});
