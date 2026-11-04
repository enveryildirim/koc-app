import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { apiOwner } from "@/modules/identity/server";

/** Veli karnesindeki öğretmen görüşünü kaydeder. body: { studentId, note } */
export async function POST(req: Request) {
  const ownerId = await apiOwner();
  if (!ownerId) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { studentId, note } = await req.json();
  const st = await prisma.student.findUnique({ where: { id: String(studentId ?? "") } });
  if (!st || st.ownerId !== ownerId) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  const text = String(note ?? "").trim().slice(0, 2000);
  await prisma.student.update({ where: { id: st.id }, data: { parentNote: text } });
  return NextResponse.json({ ok: true });
}
