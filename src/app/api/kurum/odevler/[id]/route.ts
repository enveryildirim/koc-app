import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { apiOwner } from "@/modules/identity/server";

type Ctx = { params: Promise<{ id: string }> };

async function load(ctx: Ctx) {
  const ownerId = await apiOwner();
  if (!ownerId) return { error: NextResponse.json({ error: "Giriş gerekli." }, { status: 401 }) };
  const { id } = await ctx.params;
  const hw = await prisma.homework.findFirst({ where: { id, ownerId } });
  if (!hw) return { error: NextResponse.json({ error: "Ödev bulunamadı." }, { status: 404 }) };
  return { hw };
}

export async function PUT(req: Request, ctx: Ctx) {
  const { hw, error } = await load(ctx);
  if (error) return error;
  const body = await req.json();
  const subject = String(body.subject ?? "").trim();
  const title = String(body.title ?? "").trim();
  const due = new Date(String(body.dueDate ?? "") + "T23:59:00");
  if (!subject || !title || isNaN(due.getTime())) {
    return NextResponse.json({ error: "Ders, başlık ve teslim tarihi zorunludur." }, { status: 400 });
  }
  await prisma.homework.update({
    where: { id: hw!.id },
    data: { subject, title, description: String(body.description ?? ""), dueDate: due },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { hw, error } = await load(ctx);
  if (error) return error;
  await prisma.homework.delete({ where: { id: hw!.id } });
  return NextResponse.json({ ok: true });
}
