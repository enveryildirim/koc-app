import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { apiOwner } from "@/modules/identity/server";
import { loadExam, regrade } from "@/modules/exams/server";
import { choicesFor, LETTERS } from "@/modules/exams";

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

  type SecIn = { name: string; count: number; keyA: string; keyB: string; topics?: string[]; bOrder?: number[] };
  const sections = (body.sections as SecIn[]).map((s) => {
    const count = Math.max(1, Math.min(120, Number(s.count) || 1));
    const topics = Array.isArray(s.topics) ? Array.from({ length: count }, (_, i) => String(s.topics![i] ?? "").trim().slice(0, 80)) : undefined;
    const bOrder = Array.isArray(s.bOrder) && s.bOrder.length ? s.bOrder.map(Number) : undefined;
    return {
      name: String(s.name ?? "").trim() || "Bölüm",
      count,
      keyA: clean(s.keyA, count),
      keyB: clean(s.keyB, count),
      ...(topics?.some(Boolean) ? { topics } : {}),
      ...(bOrder ? { bOrder } : {}),
    };
  });
  for (const s of sections) {
    for (const ch of s.keyA + s.keyB) {
      if (!allowed.includes(ch)) {
        return NextResponse.json({ error: `${s.name}: '${ch}' bu sınav türünde geçerli bir şık değil (${allowed}).` }, { status: 400 });
      }
    }
    if (s.bOrder) {
      const ok = s.bOrder.length === s.count && new Set(s.bOrder).size === s.count && s.bOrder.every((i) => Number.isInteger(i) && i >= 0 && i < s.count);
      if (!ok) return NextResponse.json({ error: `${s.name}: B kitapçığı eşlemesi 1–${s.count} arası her soruyu bir kez içermeli.` }, { status: 400 });
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
      scoring: scoringJson(body.scoring, sections.length),
    },
  });
  await regrade(id);
  return NextResponse.json({ ok: true });
}

/** { base, coefs } doğrulanır; geçersiz veya bölüm sayısıyla uyuşmuyorsa "" (= türün varsayılanı). */
function scoringJson(v: unknown, n: number) {
  if (!v || typeof v !== "object") return "";
  const { base, coefs } = v as { base: unknown; coefs: unknown };
  if (!Array.isArray(coefs) || coefs.length !== n) return "";
  const nums = coefs.map(Number);
  if (!Number.isFinite(Number(base)) || nums.some((c) => !Number.isFinite(c) || c < 0 || c > 100)) return "";
  return JSON.stringify({ base: Number(base), coefs: nums });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const ownerId = await apiOwner();
  const { id } = await ctx.params;
  const exam = ownerId && (await loadExam(ownerId, id));
  if (!exam) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  await prisma.exam.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
