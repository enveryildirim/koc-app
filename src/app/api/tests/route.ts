import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { getUser } from "@/modules/identity/server";
import { shareCode } from "@/modules/online-test";

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const test = await prisma.test.create({
    data: {
      ownerId: user.id,
      title: "Yeni sınav",
      shareCode: shareCode(),
      isPublished: false,
      questions: {
        create: {
          order: 0,
          type: "SINGLE",
          text: "",
          options: { create: [0, 1, 2, 3].map((order) => ({ order, text: "", isCorrect: order === 0 })) },
        },
      },
    },
  });
  return NextResponse.json({ id: test.id });
}
