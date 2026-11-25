/**
 * Modüllerin fırlattığı, framework'ten bağımsız iş hataları.
 * Route'larda `shared/http > api()` bunları HTTP durum koduna çevirir.
 */
export type AppErrorKind = "unauthorized" | "forbidden" | "invalid" | "not_found" | "conflict" | "too_many";

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
export const forbidden = (m: string) => new AppError("forbidden", m);
export const invalid = (m: string) => new AppError("invalid", m);
/** İstek sınırı aşıldı (429). `retryAfter`: saniye. */
export const tooMany = (retryAfter: number) =>
  new AppError("too_many", `Çok fazla deneme. ${Math.ceil(retryAfter / 60)} dakika sonra tekrar deneyin.`, { retryAfter });
export const notFound = (m = "Bulunamadı.") => new AppError("not_found", m);
export const conflict = (m: string, data?: Record<string, unknown>) => new AppError("conflict", m, data);
/** Kayıt yapılabilir ama kullanıcının onayı gerekir: 409 + `{ confirm: true }`. İstemci onaylarsa `confirm: true` ile yeniden gönderir. */
export const needsConfirm = (m: string) => new AppError("conflict", m, { confirm: true });
