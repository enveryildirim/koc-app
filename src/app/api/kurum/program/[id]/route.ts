import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiOwner } from "@/lib/kurum";
import { parseSlot } from "../validate";

type Ctx = { params: Promise<{ id: string }> };

async function owned(ctx: Ctx) {
  const ownerId = await apiOwner();
  if (!ownerId) return { error: NextResponse.json({ error: "Giriş gerekli." }, { status: 401 }) };
  const { id } = await ctx.params;
  const slot = await prisma.scheduleSlot.findUnique({ where: { id } });
  if (!slot || slot.ownerId !== ownerId) return { error: NextResponse.json({ error: "Bulunamadı." }, { status: 404 }) };
  return { slot, ownerId };
}

export async function PUT(req: Request, ctx: Ctx) {
  const o = await owned(ctx);
  if (o.error) return o.error;
  const r = await parseSlot(o.ownerId, await req.json());
  if (!r.data) return NextResponse.json({ error: r.error }, { status: 400 });
  await prisma.scheduleSlot.update({ where: { id: o.slot.id }, data: r.data });
  return NextResponse.json({ ok: true });
}

/** Programdan siler; geçmiş yoklamalar (LessonSession) korunur (slotId null olur). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const o = await owned(ctx);
  if (o.error) return o.error;
  await prisma.scheduleSlot.delete({ where: { id: o.slot.id } });
  return NextResponse.json({ ok: true });
}
