import "server-only";
import { NextResponse } from "next/server";
import { AppError, type AppErrorKind } from "./errors";

const STATUS: Record<AppErrorKind, number> = { unauthorized: 401, invalid: 400, not_found: 404, conflict: 409 };

/**
 * Route handler sarmalayıcı: handler'ın döndürdüğü değeri JSON'a, fırlattığı AppError'ı
 * { error } gövdeli uygun durum koduna çevirir. Response döndürülürse olduğu gibi geçer.
 */
export function api<Ctx = unknown>(handler: (req: Request, ctx: Ctx) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const out = await handler(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof AppError) return NextResponse.json({ ...e.data, error: e.message }, { status: STATUS[e.kind] });
      throw e;
    }
  };
}

/** Next 15 dinamik route parametreleri için bağlam tipi. */
export type Params<P extends Record<string, string>> = { params: Promise<P> };
