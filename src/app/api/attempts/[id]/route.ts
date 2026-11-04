import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { getUser } from "@/modules/identity/server";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await ctx.params;
  const attempt = await prisma.attempt.findUnique({ where: { id }, include: { test: true } });
  if (!user || !attempt || attempt.test.ownerId !== user.id) {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  }
  await prisma.attempt.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
