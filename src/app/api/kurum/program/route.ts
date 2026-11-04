import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { apiOwner } from "@/modules/identity/server";
import { parseSlot } from "@/modules/schedule/server";

export async function POST(req: Request) {
  const ownerId = await apiOwner();
  if (!ownerId) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const r = await parseSlot(ownerId, await req.json());
  if (!r.data) return NextResponse.json({ error: r.error }, { status: 400 });
  const slot = await prisma.scheduleSlot.create({ data: { ownerId, ...r.data } });
  return NextResponse.json({ id: slot.id });
}
