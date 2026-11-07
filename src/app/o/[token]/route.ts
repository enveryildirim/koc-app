import { NextResponse } from "next/server";
import { signInWithAccessLink } from "@/modules/identity/server";

/** Kişisel giriş linki: oturum açar ve öğretmen ekranına yönlendirir. Geçersizse giriş sayfasına. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const role = await signInWithAccessLink((await ctx.params).token);
  return NextResponse.redirect(new URL(role ? "/ogretmen" : "/giris?link=gecersiz", req.url), 303);
}
