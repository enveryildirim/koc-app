import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { apiOwner } from "@/modules/identity/server";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ownerId = await apiOwner();
  const { id } = await ctx.params;
  const c = await prisma.classroom.findUnique({ where: { id }, include: { _count: { select: { students: true } } } });
  if (!ownerId || !c || c.ownerId !== ownerId) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  if (c._count.students > 0) {
    return NextResponse.json({ error: "Sınıfta öğrenci var. Önce öğrencileri başka sınıfa taşıyın." }, { status: 409 });
  }
  await prisma.classroom.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
