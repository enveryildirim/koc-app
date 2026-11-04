import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { apiOwner } from "@/modules/identity/server";

export async function POST(req: Request) {
  const ownerId = await apiOwner();
  if (!ownerId) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { name, level } = await req.json();
  const n = String(name ?? "").trim().toLocaleUpperCase("tr-TR");
  if (!n) return NextResponse.json({ error: "Sınıf adı gerekli." }, { status: 400 });
  if (await prisma.classroom.findUnique({ where: { ownerId_name: { ownerId, name: n } } })) {
    return NextResponse.json({ error: "Bu isimde bir sınıf zaten var." }, { status: 409 });
  }
  const c = await prisma.classroom.create({ data: { ownerId, name: n, level: String(level ?? "").trim() } });
  return NextResponse.json({ id: c.id });
}
