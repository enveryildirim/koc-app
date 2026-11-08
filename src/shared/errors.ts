/**
 * Modüllerin fırlattığı, framework'ten bağımsız iş hataları.
 * Route'larda `shared/http > api()` bunları HTTP durum koduna çevirir.
 */
export type AppErrorKind = "unauthorized" | "invalid" | "not_found" | "conflict";

export class AppError extends Error {
  constructor(
    readonly kind: AppErrorKind,
    message: string,
    /** Yanıt gövdesine `error` yanında eklenen alanlar (ör. `{ confirm: true }`: istemci onay alıp yeniden göndersin). */
    readonly data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const unauthorized = (m = "Giriş gerekli.") => new AppError("unauthorized", m);
export const invalid = (m: string) => new AppError("invalid", m);
export const notFound = (m = "Bulunamadı.") => new AppError("not_found", m);
export const conflict = (m: string, data?: Record<string, unknown>) => new AppError("conflict", m, data);
/** Kayıt yapılabilir ama kullanıcının onayı gerekir: 409 + `{ confirm: true }`. İstemci onaylarsa `confirm: true` ile yeniden gönderir. */
export const needsConfirm = (m: string) => new AppError("conflict", m, { confirm: true });
