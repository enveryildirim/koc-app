import { NextResponse, type NextRequest } from "next/server";

/** Sunucu bileşenlerinin geçerli yolu bilmesi için (ör. veli sayfasında site menüsünü gizlemek). */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/|api/|favicon.ico).*)"] };
