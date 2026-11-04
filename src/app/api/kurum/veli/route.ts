import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiOwner } from "@/lib/kurum";
import { newParentToken } from "@/lib/parentReport";

/**
 * Veli karnesi linklerini yönetir.
 * body: { action: "share" | "renew" | "revoke", studentIds: string[] }
 *  - share:  linki olmayanlara link oluşturur (varsa aynısını korur)
 *  - renew:  yeni link üretir (eski link geçersiz olur)
 *  - revoke: linki iptal eder
 */
export async function POST(req: Request) {
  const ownerId = await apiOwner();
  if (!ownerId) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { action, studentIds } = (await req.json()) as { action: string; studentIds: string[] };
  if (!["share", "renew", "revoke"].includes(action) || !Array.isArray(studentIds) || studentIds.length > 2000) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const students = await prisma.student.findMany({ where: { ownerId, id: { in: studentIds } } });
  const out: Record<string, { token: string | null; sharedAt: string | null }> = {};
  for (const s of students) {
    let data: { parentToken: string | null; parentSharedAt: Date | null; parentViewedAt?: null };
    if (action === "revoke") data = { parentToken: null, parentSharedAt: null, parentViewedAt: null };
    else if (action === "renew" || !s.parentToken) data = { parentToken: newParentToken(), parentSharedAt: new Date(), parentViewedAt: null };
    else data = { parentToken: s.parentToken, parentSharedAt: s.parentSharedAt };
    const u = await prisma.student.update({ where: { id: s.id }, data });
    out[s.id] = { token: u.parentToken, sharedAt: u.parentSharedAt?.toISOString() ?? null };
  }
  return NextResponse.json({ students: out });
}
