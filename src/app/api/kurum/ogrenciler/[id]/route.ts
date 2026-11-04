import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { apiOwner } from "@/modules/identity/server";
import { cleanStudent } from "@/modules/enrollment";

type Ctx = { params: Promise<{ id: string }> };

async function own(ctx: Ctx) {
  const ownerId = await apiOwner();
  const { id } = await ctx.params;
  const st = await prisma.student.findUnique({ where: { id } });
  return ownerId && st && st.ownerId === ownerId ? st : null;
}

export async function PUT(req: Request, ctx: Ctx) {
  const st = await own(ctx);
  if (!st) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  const { data, error } = cleanStudent(await req.json());
  if (!data) return NextResponse.json({ error }, { status: 400 });
  if (data.classroomId) {
    const c = await prisma.classroom.findUnique({ where: { id: data.classroomId } });
    if (!c || c.ownerId !== st.ownerId) return NextResponse.json({ error: "Sınıf bulunamadı." }, { status: 400 });
  }
  const clash = await prisma.student.findUnique({ where: { ownerId_studentNo: { ownerId: st.ownerId, studentNo: data.studentNo } } });
  if (clash && clash.id !== st.id) return NextResponse.json({ error: `${data.studentNo} numarası başka öğrencide kayıtlı.` }, { status: 409 });
  await prisma.student.update({ where: { id: st.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const st = await own(ctx);
  if (!st) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  await prisma.student.delete({ where: { id: st.id } });
  return NextResponse.json({ ok: true });
}
