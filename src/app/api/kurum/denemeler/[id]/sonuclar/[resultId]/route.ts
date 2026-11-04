import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiOwner } from "@/lib/kurum";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; resultId: string }> }) {
  const ownerId = await apiOwner();
  const { id, resultId } = await ctx.params;
  const r = await prisma.examResult.findUnique({ where: { id: resultId }, include: { exam: true } });
  if (!ownerId || !r || r.examId !== id || r.exam.ownerId !== ownerId) {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  }
  await prisma.examResult.delete({ where: { id: resultId } });
  return NextResponse.json({ ok: true });
}
