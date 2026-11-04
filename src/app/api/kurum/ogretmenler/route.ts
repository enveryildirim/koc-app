import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiOwner } from "@/lib/kurum";

export async function POST(req: Request) {
  const ownerId = await apiOwner();
  if (!ownerId) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const branch = String(body.branch ?? "").trim();
  if (!name || !branch) return NextResponse.json({ error: "Ad ve branş gerekli." }, { status: 400 });
  const t = await prisma.teacher.create({ data: { ownerId, name, branch } });
  return NextResponse.json({ id: t.id });
}
