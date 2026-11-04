import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { apiOwner } from "@/modules/identity/server";
import { cleanStudent } from "@/modules/enrollment";

export async function POST(req: Request) {
  const ownerId = await apiOwner();
  if (!ownerId) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { data, error } = cleanStudent(await req.json());
  if (!data) return NextResponse.json({ error }, { status: 400 });
  if (data.classroomId) {
    const c = await prisma.classroom.findUnique({ where: { id: data.classroomId } });
    if (!c || c.ownerId !== ownerId) return NextResponse.json({ error: "Sınıf bulunamadı." }, { status: 400 });
  }
  if (await prisma.student.findUnique({ where: { ownerId_studentNo: { ownerId, studentNo: data.studentNo } } })) {
    return NextResponse.json({ error: `${data.studentNo} numaralı öğrenci zaten kayıtlı.` }, { status: 409 });
  }
  const st = await prisma.student.create({ data: { ownerId, ...data } });
  return NextResponse.json({ id: st.id });
}
