import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const user = await prisma.user.findUnique({ where: { email: String(email ?? "").toLowerCase().trim() } });
  if (!user || !(await bcrypt.compare(String(password ?? ""), user.passwordHash))) {
    return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
