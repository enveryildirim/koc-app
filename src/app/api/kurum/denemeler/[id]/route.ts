import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiOwner } from "@/lib/kurum";
import { loadExam, regrade } from "@/lib/examServer";
import { choicesFor, LETTERS } from "@/lib/exam";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const ownerId = await apiOwner();
  const { id } = await ctx.params;
  const exam = ownerId && (await loadExam(ownerId, id));
  if (!exam) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  const body = await req.json();
  const allowed = LETTERS.slice(0, choicesFor(exam.type));
  const clean = (k: string, n: number) =>
    String(k ?? "")
      .toUpperCase()
      .replace(/[^A-E]/g, "")
      .slice(0, n);

  const sections = (body.sections as { name: string; count: number; keyA: string; keyB: string }[]).map((s) => {
    const count = Math.max(1, Math.min(120, Number(s.count) || 1));
    return { name: String(s.name ?? "").trim() || "Bölüm", count, keyA: clean(s.keyA, count), keyB: clean(s.keyB, count) };
  });
  for (const s of sections) {
    for (const ch of s.keyA + s.keyB) {
      if (!allowed.includes(ch)) {
        return NextResponse.json({ error: `${s.name}: '${ch}' bu sınav türünde geçerli bir şık değil (${allowed}).` }, { status: 400 });
      }
    }
  }
  const total = sections.reduce((a, s) => a + s.count, 0);
  if (total > 180) return NextResponse.json({ error: "Toplam soru sayısı en fazla 180 olabilir." }, { status: 400 });

  await prisma.exam.update({
    where: { id },
    data: {
      name: String(body.name ?? exam.name).trim() || exam.name,
      date: body.date ? new Date(body.date) : exam.date,
      bookletB: body.bookletB ?? exam.bookletB,
      wrongPer: Math.max(0, Math.min(10, Number(body.wrongPer ?? exam.wrongPer))),
      sections: JSON.stringify(sections),
    },
  });
  await regrade(id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const ownerId = await apiOwner();
  const { id } = await ctx.params;
  const exam = ownerId && (await loadExam(ownerId, id));
  if (!exam) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  await prisma.exam.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
