import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiOwner } from "@/lib/kurum";
import { parseSlot } from "./validate";

export async function POST(req: Request) {
  const ownerId = await apiOwner();
  if (!ownerId) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const r = await parseSlot(ownerId, await req.json());
  if (!r.data) return NextResponse.json({ error: r.error }, { status: 400 });
  const slot = await prisma.scheduleSlot.create({ data: { ownerId, ...r.data } });
  return NextResponse.json({ id: slot.id });
}
