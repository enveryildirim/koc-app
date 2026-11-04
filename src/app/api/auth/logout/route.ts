import { NextResponse } from "next/server";
import { destroySession } from "@/modules/identity/server";

export async function POST(req: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/", req.url), 303);
}
