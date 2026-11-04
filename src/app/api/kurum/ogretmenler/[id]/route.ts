import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { apiOwner } from "@/modules/identity/server";

type Ctx = { params: Promise<{ id: string }> };

async function owned(ctx: Ctx) {
  const ownerId = await apiOwner();
  if (!ownerId) return { error: NextResponse.json({ error: "Giriş gerekli." }, { status: 401 }) };
  const { id } = await ctx.params;
  const t = await prisma.teacher.findUnique({ where: { id } });
  if (!t || t.ownerId !== ownerId) return { error: NextResponse.json({ error: "Bulunamadı." }, { status: 404 }) };
  return { t };
}

export async function PUT(req: Request, ctx: Ctx) {
  const r = await owned(ctx);
  if (r.error) return r.error;
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const branch = String(body.branch ?? "").trim();
  if (!name || !branch) return NextResponse.json({ error: "Ad ve branş gerekli." }, { status: 400 });
  await prisma.teacher.update({ where: { id: r.t.id }, data: { name, branch } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const r = await owned(ctx);
  if (r.error) return r.error;
  await prisma.teacher.delete({ where: { id: r.t.id } });
  return NextResponse.json({ ok: true });
}
