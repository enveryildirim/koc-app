import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiOwner } from "@/lib/kurum";
import { EXAM_TYPES } from "@/lib/exam";

export async function POST(req: Request) {
  const ownerId = await apiOwner();
  if (!ownerId) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const body = await req.json();
  const t = EXAM_TYPES[body.type] ?? EXAM_TYPES.SERBEST;
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Sınav adı gerekli." }, { status: 400 });
  const sections = t.sections.map((s) => ({ name: s.name, count: s.count, keyA: "", keyB: "" }));
  const exam = await prisma.exam.create({
    data: {
      ownerId,
      name,
      type: EXAM_TYPES[body.type] ? body.type : "SERBEST",
      date: body.date ? new Date(body.date) : new Date(),
      sections: JSON.stringify(sections),
      bookletB: body.bookletB !== false,
      wrongPer: t.wrongPer,
    },
  });
  return NextResponse.json({ id: exam.id });
}
