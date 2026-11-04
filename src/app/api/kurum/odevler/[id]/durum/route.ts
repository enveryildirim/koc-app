import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { apiOwner } from "@/modules/identity/server";
import { HOMEWORK } from "@/modules/homework";

type Update = { studentId: string; status?: string; note?: string };

/** Öğrenci durumlarını günceller (tek ya da toplu). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ownerId = await apiOwner();
  if (!ownerId) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { id } = await ctx.params;
  const hw = await prisma.homework.findFirst({ where: { id, ownerId } });
  if (!hw) return NextResponse.json({ error: "Ödev bulunamadı." }, { status: 404 });

  const { updates } = (await req.json()) as { updates: Update[] };
  if (!Array.isArray(updates)) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  // Yalnızca bu kurumun öğrencileri
  const valid = new Set(
    (
      await prisma.student.findMany({
        where: { ownerId, id: { in: updates.map((u) => u.studentId) } },
        select: { id: true },
      })
    ).map((s) => s.id),
  );

  await prisma.$transaction(
    updates
      .filter((u) => valid.has(u.studentId) && (u.status === undefined || u.status in HOMEWORK))
      .map((u) => {
        const data: { status?: string; note?: string } = {};
        if (u.status !== undefined) data.status = u.status;
        if (u.note !== undefined) data.note = String(u.note).slice(0, 500);
        return prisma.homeworkStatus.upsert({
          where: { homeworkId_studentId: { homeworkId: hw.id, studentId: u.studentId } },
          update: data,
          create: { homeworkId: hw.id, studentId: u.studentId, status: data.status ?? "PENDING", note: data.note ?? "" },
        });
      }),
  );
  return NextResponse.json({ ok: true });
}
