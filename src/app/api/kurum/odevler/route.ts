import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiOwner } from "@/lib/kurum";

/** Yeni ödev: sınıfın tüm öğrencileri için PENDING durum kaydı oluşturur. */
export async function POST(req: Request) {
  const ownerId = await apiOwner();
  if (!ownerId) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const body = await req.json();
  const subject = String(body.subject ?? "").trim();
  const title = String(body.title ?? "").trim();
  const due = new Date(String(body.dueDate ?? "") + "T23:59:00");
  if (!subject || !title || isNaN(due.getTime())) {
    return NextResponse.json({ error: "Ders, başlık ve teslim tarihi zorunludur." }, { status: 400 });
  }
  const classroom = await prisma.classroom.findFirst({ where: { id: String(body.classroomId ?? ""), ownerId } });
  if (!classroom) return NextResponse.json({ error: "Sınıf bulunamadı." }, { status: 404 });

  const students = await prisma.student.findMany({ where: { classroomId: classroom.id, ownerId }, select: { id: true } });
  const hw = await prisma.homework.create({
    data: {
      ownerId,
      classroomId: classroom.id,
      subject,
      title,
      description: String(body.description ?? ""),
      dueDate: due,
      statuses: { create: students.map((s) => ({ studentId: s.id, status: "PENDING" })) },
    },
  });
  return NextResponse.json({ id: hw.id, students: students.length });
}
