import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { apiOwner } from "@/modules/identity/server";

/** Ders oturumunu ve yoklamasını siler. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ownerId = await apiOwner();
  if (!ownerId) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { id } = await ctx.params;
  const s = await prisma.lessonSession.findUnique({ where: { id } });
  if (!s || s.ownerId !== ownerId) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  await prisma.lessonSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
